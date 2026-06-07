from functools import wraps

from datetime import datetime
import bcrypt
from flask import Flask, jsonify, request
from flask_cors import CORS
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
CORS(app)

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
            current_user_id = data['UserID']
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

@app.route('/register', methods=['POST'])
def register():
    """Public endpoint — no token required. Creates a standard (non-admin) user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
 
    first_name = data.get('FirstName') or data.get('firstName') or data.get('first_name')
    last_name  = data.get('LastName')  or data.get('lastName')  or data.get('last_name')
    email      = data.get('Email')     or data.get('email')
    password   = data.get('Password')  or data.get('password')
 
    if not all([first_name, last_name, email, password]):
        return jsonify({"error": "FirstName, LastName, Email, and Password are required"}), 400
 
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
 
        # Make sure the email isn't already taken
        cursor.execute("SELECT UserID FROM Users WHERE Email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 409  # 409 Conflict
 
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
 
        insert_cursor = cnx.cursor(prepared=True)
        insert_cursor.execute(
            "INSERT INTO Users (FirstName, LastName, AdminPrivileges, Email, Password) VALUES (%s, %s, %s, %s, %s)",
            (first_name, last_name, False, email, hashed)
        )
        cnx.commit()
        new_id = insert_cursor.lastrowid
 
        # Return a token so the user is logged in immediately after registering
        token = jwt.encode(
            {'UserID': new_id, 'AdminPrivileges': False},
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        return jsonify({"message": "User created", "token": token}), 201
 
    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500
 
    finally:
        if 'insert_cursor' in locals(): insert_cursor.close()
        if 'cursor' in locals(): cursor.close()
        if 'cnx' in locals(): cnx.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() #data provided by client
    # Basic validation
    # Accept both capitalised and lowercase field names from the frontend
    email = data.get('Email') or data.get('email')
    password = data.get('Password') or data.get('password')
    if not data or not email or not password:
        return jsonify({"error": "Email and Password are required"}), 400 # status 400 = Bad Request
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True) 

    cursor.execute("SELECT * FROM Users WHERE Email = %s", (data['Email'],))
    user = cursor.fetchone()
    cursor.close()
    db.close()
    
    if not user:
        return jsonify({"error": "Invalid email"}), 401 # status 401 = Unauthorized
    
    password_valid = bcrypt.checkpw(data['Password'].encode('utf-8'), user['Password'].encode('utf-8'))
    if not password_valid:
        return jsonify({"error": "Invalid password"}), 401 # status 401 = Unauthorized

    # Citing chatGPT for help with JWT encoding of token below
    token = jwt.encode({
        'UserID': user['UserID'],
        'AdminPrivileges': user['AdminPrivileges']
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
        cursor = cnx.cursor(dictionary=True)  
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
            

@app.route('/users/me', methods=['GET'])
@token_required
def get_me(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT UserID, FirstName, LastName, Email, AdminPrivileges FROM Users WHERE UserID = %s",
                       (current_user_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        row['Name'] = f"{row.get('FirstName','')} {row.get('LastName','')}".strip()
        return jsonify(row), 200
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'cnx' in locals(): cnx.close()


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
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(
                data['Password'].encode('utf-8'),
                salt
            )
            values.append(hashed.decode('utf-8'))

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
        cursor.execute(query, (current_user_id,))
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
        cursor = cnx.cursor(dictionary=True)  
        query = ("SELECT * "
                 "FROM Habits "
                 "WHERE HabitID = %s "
                 "AND UserID = %s") 
        cursor.execute(query, (habit_id, current_user_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({"message": "Habit not found"}), 404 #status 404 = Not Found
        
        return jsonify(row), 200 #status 200 = OK

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
        
        # accepts camelcase
        date_logged = data.get('DateLogged') or data.get('date') or data.get('dateLogged')
        completion_status = data.get('CompletionStatus', data.get('completionStatus', 'Completed'))
        # normalize ISO 2026-06-07T17:48:22.000Z -> 2026-06-07 17:48:22
        if isinstance(date_logged, str):
            date_logged = date_logged.replace('T', ' ').replace('Z', '').split('.')[0]

        query = ("INSERT INTO HabitLogs (HabitID, UserID, DateLogged, CompletionStatus) VALUES (%s, %s, %s, %s)")
        values = (habit_id, current_user_id, date_logged , completion_status)
        cursor.execute(query, values)
        cnx.commit()

        # handle streak w count of consecutive days ending today with at least one log
        day_cursor = cnx.cursor(dictionary=True)
        day_cursor.execute(
            "SELECT DISTINCT DATE(DateLogged) AS d FROM HabitLogs WHERE HabitID = %s AND UserID = %s",
            (habit_id, current_user_id),
        )
        days = {r['d'] for r in day_cursor.fetchall()}
        from datetime import date, timedelta
        streak = 0
        d = date.today()
        while d in days:
            streak += 1
            d -= timedelta(days=1)
        day_cursor.execute("UPDATE Habits SET Streak = %s WHERE HabitID = %s", (streak, habit_id))
        cnx.commit()
        day_cursor.close()

        return jsonify({"message": "Habit log created", "streak": streak}), 201 #status 201 = Created

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
@app.route('/habits/<int:habit_id>/logs', methods=['GET'])
@token_required
def get_habit_logs(current_user_id, current_user_is_admin, *args, **kwargs):
    
    habit_id = kwargs['habit_id']
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        query = ("SELECT * "
                 "FROM HabitLogs "
                 "WHERE HabitID = %s "
                 "AND UserID = %s") 
        cursor.execute(query, (habit_id, current_user_id))
        rows = cursor.fetchall()
        # Return empty list (not 404) so the frontend can distinguish "no logs yet" from an error
        return jsonify(rows), 200
        
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


@app.route('/friends', methods=['GET'])
@token_required
def get_friends(current_user_id, current_user_is_admin, *args, **kwargs):
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        query = """
            SELECT 
                u.UserID as id, 
                CONCAT(u.FirstName, ' ', u.LastName) as name,
                (SELECT COUNT(*) FROM Habits WHERE UserID = u.UserID) as totalHabits,
                (SELECT COUNT(DISTINCT hl.HabitID) FROM HabitLogs hl 
                 JOIN Habits h ON hl.HabitID = h.HabitID 
                 WHERE h.UserID = u.UserID AND DATE(hl.DateLogged) = CURDATE()) as completed
            FROM Friendships f
            JOIN Users u ON (u.UserID = f.SenderID OR u.UserID = f.RecipientID) AND u.UserID != %s
            WHERE (f.SenderID = %s OR f.RecipientID = %s) AND f.FriendshipStatus = 'Accepted'
        """
        cursor.execute(
            query,
            (current_user_id, current_user_id, current_user_id)
        )
 
        rows = cursor.fetchall()
        # Return empty list for users with no friends yet (not a 404 error)
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
        cursor = cnx.cursor(dictionary=True)  
        query = ("SELECT * "
                 "FROM Friendships "
                 "WHERE SenderID = %s "
                 "AND FriendshipStatus = 'Pending'")
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        # Return empty list when there are no pending incoming requests
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

@app.route('/friend_requests/incoming', methods=['GET'])
@token_required
def get_incoming_friend_requests(current_user_id, current_user_is_admin, *args, **kwargs):
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        query = """
            SELECT 
                f.RequestID as id,
                CONCAT(u.FirstName, ' ', u.LastName) as senderName
            FROM Friendships f
            JOIN Users u ON f.SenderID = u.UserID
            WHERE f.RecipientID = %s AND f.FriendshipStatus = 'Pending'
        """
        cursor.execute(query, (current_user_id,))
        rows = cursor.fetchall()
        # Return empty list when there are no pending incoming requests
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

@app.route('/friends/<int:friend_id>', methods=['DELETE'])
@token_required
def delete_friend(current_user_id, current_user_is_admin, *args, **kwargs):
    friend_id = kwargs['friend_id']

    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()
        # frontend passes the other user's UserID, not the RequestID
        query = ("DELETE FROM Friendships "
                 "WHERE FriendshipStatus = 'Accepted' "
                 "AND ((SenderID = %s AND RecipientID = %s) OR (SenderID = %s AND RecipientID = %s))")
        cursor.execute(query, (current_user_id, friend_id, friend_id, current_user_id))
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

@app.route('/friend_requests', methods=['POST'])
@token_required
def send_friend_request(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400 #status 400 = Bad Request


        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)


        query = ("INSERT INTO Friendships (SenderID, RecipientID, FriendshipStatus) VALUES (%s, %s, %s)")
        values = (current_user_id, data['RecipientID'], 'Pending')
        cursor.execute(query, values)
        cnx.commit()

        return jsonify({"message": "Friend request sent"}), 201 #status 201 = Created

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()


@app.route('/friend_requests/<int:request_id>', methods=['PUT'])
@token_required
def accept_friend_request(current_user_id, current_user_is_admin, *args, **kwargs):
    request_id = kwargs['request_id']
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(prepared=True)
        query = ("UPDATE Friendships SET FriendshipStatus = %s WHERE RequestID = %s AND RecipientID = %s AND FriendshipStatus = %s")
        values = ("Accepted", request_id, current_user_id, "Pending")

        cursor.execute(query, values)
        cnx.commit()
    
        affected = cursor.rowcount

        if affected == 0:
            return jsonify({"message": "Friend request not found"}), 404 #status 404 = Not Found

        else:
            return jsonify({"message": "Friend request updated"}), 200 #status 200 = OK

    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500 #status 500 = Server Error

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnx' in locals():
            cnx.close()

@app.route('/friend_requests/<int:friendship_id>', methods=['DELETE'])
@token_required
def reject_friend_request(current_user_id, current_user_is_admin, *args, **kwargs):
    friendship_id = kwargs['friendship_id']

    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("DELETE "
                 "FROM Friendships "
                 "WHERE RequestID = %s AND (SenderID = %s OR RecipientID = %s) AND FriendshipStatus = 'Pending'")
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

@app.route('/habits/friends', methods=['GET'])
@token_required
def get_friend_habits(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor()   
        query = ("SELECT h.* "
                 "FROM Habits h "
                "JOIN Friendships f "
                "ON (f.SenderID = %s AND f.RecipientID = h.UserID OR f.RecipientID = %s AND f.SenderID = h.UserID) "
                 "WHERE f.FriendshipStatus = 'Accepted' ")
        cursor.execute(query, (current_user_id, current_user_id))
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

@app.route('/friends/<int:friend_id>/profile', methods=['GET'])
@token_required
def get_friend_profile(current_user_id, current_user_is_admin, *args, **kwargs):
    friend_id = kwargs['friend_id']
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        
        # 1. Verify friendship exists and is accepted
        check_query = """
            SELECT * FROM Friendships 
            WHERE ((SenderID = %s AND RecipientID = %s) OR (SenderID = %s AND RecipientID = %s))
            AND FriendshipStatus = 'Accepted'
        """
        cursor.execute(check_query, (current_user_id, friend_id, friend_id, current_user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Not friends with this user"}), 403

        # 2. Get User Info
        cursor.execute("SELECT FirstName, LastName, Email FROM Users WHERE UserID = %s", (friend_id,))
        user_row = cursor.fetchone()
        user_data = {"name": f"{user_row['FirstName']} {user_row['LastName']}", "email": user_row['Email']}

        # 3. Get Habits and Logs
        cursor.execute("SELECT * FROM Habits WHERE UserID = %s", (friend_id,))
        habits = cursor.fetchall()
        
        cursor.execute("SELECT * FROM HabitLogs WHERE UserID = %s", (friend_id,))
        logs = cursor.fetchall()
        
        # 4. Format payload for React
        today_str = datetime.now().date().isoformat()
        log_dates = [log['DateLogged'].isoformat() for log in logs]
        
        total_habits = len(habits)
        completed_today = 0
        longest_streak = 0
        
        for habit in habits:
            habit_logs = [l for l in logs if l['HabitID'] == habit['HabitID']]
            habit['completedToday'] = any(l['DateLogged'].date().isoformat() == today_str for l in habit_logs)
            if habit['completedToday']: completed_today += 1
            if habit['Streak'] > longest_streak: longest_streak = habit['Streak']

        stats = {
            "totalHabits": total_habits,
            "completedToday": completed_today,
            "failedToday": total_habits - completed_today,
            "longestStreak": longest_streak
        }

        return jsonify({"user": user_data, "stats": stats, "habits": habits, "logDates": log_dates}), 200
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'cnx' in locals(): cnx.close()

@app.route('/users/search', methods=['GET'])
@token_required
def search_users(current_user_id, current_user_is_admin, *args, **kwargs):
    query_string = request.args.get('query', '')
    if not query_string or len(query_string) < 2:
        return jsonify([]), 200
    
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        # Search by first name, last name, or email (excluding self)
        # Maps to the 'id' and 'name' fields expected by FriendsScreen.js
        search_term = f"%{query_string}%"
        query = """
            SELECT UserID as id, CONCAT(FirstName, ' ', LastName) as name, Email as email 
            FROM Users 
            WHERE (FirstName LIKE %s OR LastName LIKE %s OR Email LIKE %s) AND UserID != %s
            LIMIT 20
        """
        cursor.execute(query, (search_term, search_term, search_term, current_user_id))
        rows = cursor.fetchall()
        return jsonify(rows), 200
    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'cnx' in locals(): cnx.close()

@app.route('/friends/activity', methods=['GET'])
@token_required
def get_recent_activity(current_user_id, current_user_is_admin, *args, **kwargs):
    try:
        cnx = get_db_connection()
        cursor = cnx.cursor(dictionary=True)
        # Fetch recent logs from accepted friends mapping to the frontend's expected properties
        query = """
            SELECT hl.HabitLogID as id, CONCAT(u.FirstName, ' ', u.LastName) as user, h.HabitName as task,
                   DATE_FORMAT(hl.DateLogged, '%b %d, %Y') as time
            FROM HabitLogs hl
            JOIN Habits h ON hl.HabitID = h.HabitID
            JOIN Users u ON h.UserID = u.UserID
            JOIN Friendships f ON (f.SenderID = %s AND f.RecipientID = u.UserID OR f.RecipientID = %s AND f.SenderID = u.UserID)
            WHERE f.FriendshipStatus = 'Accepted'
            ORDER BY hl.DateLogged DESC
            LIMIT 15
        """
        cursor.execute(query, (current_user_id, current_user_id))
        rows = cursor.fetchall()
        return jsonify(rows), 200
    except Exception as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'cnx' in locals(): cnx.close()

if __name__ == '__main__':
    app.run(port=8080)
