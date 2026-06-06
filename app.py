from functools import wraps

import bcrypt
from flask import Flask, jsonify, request
import mysql.connector
import json
import jwt

'''
SERVER SIDE

Requires installation
    mysql connector: pip3 install mysql-connector-python      (--break-system-packages if needed)
    Based on: https://dev.mysql.com/doc/connector-python/en/connector-python-example-connecting.html

    flask: pip3 install flask    (--break-system-packages if needed)

Usage: 
    Start flask running in a terminal: 
        flask --app app.py run --port 8080
    From browser: 
        localhost:8080/
        localhost:8080/restaurants

    Use browser Postman to try the following at http://localhost:8080/:
        GET /restaurants      -- see all restaurants
        GET /restaurants/<id> -- see one restaurant with ID
        POST /restaurants     -- insert one restaurant put data in Postman, select body and raw
        DELETE /restaurants/<id>  -- remove restaurant with ID 
'''

app = Flask(__name__)

# Load credentials from the JSON file
with open('db.json') as config_file:
    credentials = json.load(config_file)
app.config['SECRET_KEY'] = credentials['jwt_secret_key']
credentials = credentials['localhost']

def get_db_connection():
    return mysql.connector.connect(host=credentials['host'], user=credentials['user'], 
           password=credentials['password'], database=credentials['database'])

# checks that the user is logged in
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            parts = auth_header.split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]

        if not token:
            return jsonify({"error": "Token is missing. Please log in."}), 401 # status 401 = Unauthorized
        
        try: 
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['EmployeeID']
            current_user_is_admin = data['AdminPrivileges']
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401 # status 401 = Unauthorized
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token is invalid"}), 401 # status 401 = Unauthorized
        
        return f(current_user_id, current_user_is_admin, *args, **kwargs)
    
    return decorated

# checks that the user is an admin
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            parts = auth_header.split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]

        if not token:
            return jsonify({"error": "Token is missing. Please log in."}), 401 # status 401 = Unauthorized
        
        try: 
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['UserID']
            current_user_is_admin = data['AdminPrivileges']
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401 # status 401 = Unauthorized
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token is invalid"}), 401 # status 401 = Unauthorized
        
        if not current_user_is_admin:
            return jsonify({"error": "Admin access is required."}), 403 # status 403 = Forbidden
        
        return f(current_user_id, current_user_is_admin, *args, **kwargs)
    
    return decorated


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() #data provided by client
    # Basic validation
    if not data or 'Email' not in data or 'Password' not in data:
        return jsonify({"error": "Email and Password are required"}), 400 # status 400 = Bad Request
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True) 

    cursor.execute("SELECT * FROM Employees WHERE Email = %s", (data['Email'],))
    employee = cursor.fetchone()
    cursor.close()
    db.close()
    
    if not employee:
        return jsonify({"error": "Invalid email"}), 401 # status 401 = Unauthorized
    
    password_valid = bcrypt.checkpw(data['Password'].encode('utf-8'), employee['Password'].encode('utf-8'))
    if not password_valid:
        return jsonify({"error": "Invalid password"}), 401 # status 401 = Unauthorized

    # Citing chatGPT for help with JWT encoding of token below
    token = jwt.encode({
        'UserID': employee['UserID'],
        'AdminPrivileges': employee['AdminPrivileges']
    }, app.config['SECRET_KEY'], algorithm='HS256')

    return jsonify({"message": "Login successful", "token": token}), 200 # status 200 = OK


#get all habits (well first 10 here anyway, by UserID)
@app.route('/habits', methods=['GET'])
@token_required
@admin_required
def get_habits(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Habits "
                 "ORDER BY HabitID "
                 "LIMIT 10")
        cursor.execute(query)
        rows = cursor.fetchall()
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


@app.route('/habits/me', methods=['GET'])
@token_required
def get_own_habits(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Habits "
                 "WHERE UserID = %s ")
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()



@app.route('/users', methods=['POST'])
@token_required
@admin_required
def create_user(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request


        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)

        salt = bcrypt.gensalt()
        hash = bcrypt.hashpw(data['Password'].encode('utf-8'), salt)
        query = ("INSERT INTO Users ( FirstName, LastName, AdminPrivileges, Email, Password) VALUES (%s, %s, %s, %s, %s)")
        values = (data['FirstName'], data['LastName'], data['AdminPrivileges'], data['Email'], hash)
        cursor.execute(query, values)
        cnx.commit()

        return jsonify({"message": "User created"}), 201 #status 201 = Created

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


# @app.route('/employees', methods=['PUT'])
# @token_required
# @admin_required
# def update_employee(current_user_id, current_user_is_admin, *args, **kwargs):
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request
        
#         if 'EmployeeID' not in data:
#             return jsonify({"error": "EmployeeID is required for update"}), 400 #status 400 = Bad Request
        
#         fields = []
#         values = []

#         if 'EmployeeFirstName' in data:
#             fields.append("EmployeeFirstName = %s")
#             values.append(data['EmployeeFirstName'])
#         if 'EmployeeLastName' in data:
#             fields.append("EmployeeLastName = %s")
#             values.append(data['EmployeeLastName']) 
#         if 'AdminPrivileges' in data:
#             fields.append("AdminPrivileges = %s")
#             values.append(data['AdminPrivileges'])
#         if 'Username' in data:
#             fields.append("Username = %s")
#             values.append(data['Username'])
#         if 'Password' in data:
#             fields.append("Password = %s")
#             values.append(data['Password'])

#         cnx = get_db_connection()
#         cursor = cnx.cursor(prepared=True)
#         query = ("UPDATE Employees SET " + ", ".join(fields) + " WHERE EmployeeID = %s")
#         values.append(data['EmployeeID'])
#         cursor.execute(query, values)
#         cnx.commit()
    
#         affected = cursor.rowcount

#         if affected == 0:
#             return jsonify({"message": "Employee not found"}), 404 #status 404 = Not Found

#         else:
#             return jsonify({"message": "Employee updated"}), 200 #status 200 = OK

#     except Exception as e:
#         print(f"Database error: {e}")
#         return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

#     finally:
#         if 'cursor' in locals():
#             cursor.close()
#         if 'cnx' in locals():
#             cnx.close()
            

@app.route('/users/me', methods=['PUT'])
@token_required
def update_me(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request
        
        fields = []
        values = []

        if 'FirstName' in data:
            fields.append("FirstName = %s")
            values.append(data['FirstName'])
        if 'LastName' in data:
            fields.append("LastName = %s")
            values.append(data['LastName']) 
        if 'AdminPrivileges' in data and current_user_is_admin: # only allow updating admin privileges if user is an admin
            fields.append("AdminPrivileges = %s")
            values.append(data['AdminPrivileges'])
        if 'Email' in data:
            fields.append("Email = %s")
            values.append(data['Email'])
        if 'Password' in data:
            fields.append("Password = %s")
            values.append(data['Password'])

        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)
        query = ("UPDATE Users SET " + ", ".join(fields) + " WHERE UserID = %s")
        values.append(current_user_id)
        cursor.execute(query, values)
        cnx.commit()
    
        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "User not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "User updated"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()
            

@app.route('/users/me', methods=['DELETE'])
@token_required
def delete_users(current_user_id, current_user_is_admin, *args, **kwargs):


    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("DELETE "
                 "FROM Users "
                 "WHERE UserID = %s")
        cursor.execute(query, (current_user_id))
        cnx.commit()

        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "User not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "User deleted"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()



@app.route('/habits', methods=['POST'])
@token_required
def create_habit(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request


        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)


        query = ("INSERT INTO Habits (HabitName, UserID, HabitDescription) VALUES (%s, %s, %s)")
        values = (data['HabitName'], current_user_id, data['HabitDescription'])
        cursor.execute(query, values)
        cnx.commit()

        return jsonify({"message": "Habit created"}), 201 #status 201 = Created

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()



#get specific habit by ID
@app.route('/habits/<int:habit_id>', methods=['GET'])
@token_required
def get_habit(current_user_id, current_user_is_admin, *args, **kwargs):
    
    habit_id = kwargs['habit_id']
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Habits "
                 "WHERE HabitID = %s"
                 "AND UserID = %s") 
        cursor.execute(query, (habit_id, current_user_id))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"message": "Habit not found"}), 404 #status 404 = Not Found
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


@app.route('/habits/<int:habit_id>', methods=['PUT'])
@token_required
def update_habit(current_user_id, current_user_is_admin, *args, **kwargs):
    habit_id = kwargs['habit_id']
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request
        
        fields = []
        values = []

        if 'HabitName' in data:
            fields.append("HabitName = %s")
            values.append(data['HabitName'])
        if 'HabitDescription' in data:
            fields.append("HabitDescription = %s")
            values.append(data['HabitDescription']) 
        if 'HabitStatus' in data:
            fields.append("HabitStatus = %s")
            values.append(data['HabitStatus'])

        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)
        query = ("UPDATE Habits SET " + ", ".join(fields) + " WHERE HabitID = %s AND UserID = %s")
        values.append(habit_id)
        values.append(current_user_id)
        cursor.execute(query, values)
        cnx.commit()
    
        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Habit not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Habit updated"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


@app.route('/habits/<int:habit_id>', methods=['DELETE'])
@token_required
def delete_habit(current_user_id, current_user_is_admin, *args, **kwargs):
    habit_id = kwargs['habit_id']

    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("DELETE "
                 "FROM Habits "
                 "WHERE HabitID = %s AND UserID = %s")
        cursor.execute(query, (habit_id, current_user_id))
        cnx.commit()

        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Habit not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Habit deleted"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


@app.route('/habits/<int:habit_id>/log', methods=['POST'])
@token_required
def create_habit_log(current_user_id, current_user_is_admin, *args, **kwargs):
    habit_id = kwargs['habit_id']
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request


        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)


        query = ("INSERT INTO HabitLogs (HabitID, UserID, DateLogged, CompletionStatus) VALUES (%s, %s, %s, %s)")
        values = (habit_id, current_user_id, data['DateLogged'], data['CompletionStatus'])
        cursor.execute(query, values)
        cnx.commit()

        return jsonify({"message": "Habit log created"}), 201 #status 201 = Created

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

@app.route('/habits/<int:habit_id>/logs/<int:log_id>', methods=['DELETE'])
@token_required
def delete_habit_log(current_user_id, current_user_is_admin, *args, **kwargs):
    habit_id = kwargs['habit_id']
    log_id = kwargs['log_id']

    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("DELETE "
                 "FROM HabitLogs "
                 "WHERE HabitLogID = %s AND UserID = %s")
        cursor.execute(query, (log_id, current_user_id))
        cnx.commit()

        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Habit log not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Habit log deleted"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

@app.route('/habits/<int:habit_id>/logs/<int:log_id>', methods=['PUT'])
@token_required
def update_habit_log(current_user_id, current_user_is_admin, *args, **kwargs):
    habit_id = kwargs['habit_id']
    log_id = kwargs['log_id']
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request
        
        fields = []
        values = []

        if 'DateLogged' in data:
            fields.append("DateLogged = %s")
            values.append(data['DateLogged'])
        if 'CompletionStatus' in data:
            fields.append("CompletionStatus = %s")
            values.append(data['CompletionStatus']) 

        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)
        query = ("UPDATE HabitLogs SET " + ", ".join(fields) + " WHERE HabitLogID = %s AND UserID = %s")
        values.append(log_id)
        values.append(current_user_id)
        cursor.execute(query, values)
        cnx.commit()
    
        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Habit log not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Habit log updated"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

#get specific habit by ID
@app.route('/habits/<int:habit_id>', methods=['GET'])
@token_required
def get_habit_logs(current_user_id, current_user_is_admin, *args, **kwargs):
    
    habit_id = kwargs['habit_id']
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM HabitLogs "
                 "WHERE HabitID = %s"
                 "AND UserID = %s") 
        cursor.execute(query, (habit_id, current_user_id))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"message": "Habit logs not found"}), 404 #status 404 = Not Found
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


#get specific habit by ID
@app.route('/friends', methods=['GET'])
@token_required
def get_friends(current_user_id, current_user_is_admin, *args, **kwargs):
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Friendships "
                 "WHERE SenderID = %s"
                 "AND Status = 'Accepted' ") 
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"message": "Friends not found"}), 404 #status 404 = Not Found
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

#get specific habit by ID
@app.route('/friend_requests/outgoing', methods=['GET'])
@token_required
def get_outgoing_friend_requests(current_user_id, current_user_is_admin, *args, **kwargs):
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Friendships "
                 "WHERE SenderID = %s"
                 "AND Status = 'Pending' ") 
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"message": "Friend requests not found"}), 404 #status 404 = Not Found
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

#get specific habit by ID
@app.route('/friend_requests/incoming', methods=['GET'])
@token_required
def get_incoming_friend_requests(current_user_id, current_user_is_admin, *args, **kwargs):
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT * "
                 "FROM Friendships "
                 "WHERE RecipientID = %s"
                 "AND Status = 'Pending' ") 
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"message": "Friend requests not found"}), 404 #status 404 = Not Found
        
        return jsonify(rows), 200 #status 200 = OK

    except Exception as e:
        # Log the error (optional, but recommended for debugging)
        print(f"Database error: {e}")
        
        # Return a JSON error message and a 500 status code
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

@app.route('/friends/<int:friendship_id>', methods=['DELETE'])
@token_required
def delete_friend(current_user_id, current_user_is_admin, *args, **kwargs):
    friendship_id = kwargs['friendship_id']

    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("DELETE "
                 "FROM Friendships "
                 "WHERE FriendshipID = %s AND (SenderID = %s OR RecipientID = %s)")
        cursor.execute(query, (friendship_id, current_user_id, current_user_id))
        cnx.commit()

        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Friend not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Friend deleted"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error
        
    finally:
        # Ensure the connection is closed even if an error occurs
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()
