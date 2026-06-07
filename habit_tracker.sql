-- ============================================
-- Final Project: Habits
-- Name: Rachel Pontes, Akshee Chopra
-- Course: Dartmouth CS 61 Spring 2026
-- ============================================

Use habits;

DROP TABLE IF EXISTS HabitLogs;
DROP TABLE IF EXISTS Friendships;
DROP TABLE IF EXISTS Habits;
DROP TABLE IF EXISTS Users;

CREATE TABLE Users (
	UserID INT PRIMARY KEY AUTO_INCREMENT,
    FirstName VARCHAR(80) NOT NULL,
    LastName VARCHAR(80) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    AdminPrivileges BOOLEAN DEFAULT FALSE,
    Password VARCHAR(255) NOT NULL
);

CREATE TABLE Habits (
	HabitID INT PRIMARY KEY AUTO_INCREMENT UNIQUE,
    UserID INT,
    HabitName VARCHAR(80) NOT NULL,
    HabitDescription VARCHAR(300) NOT NULL,
    HabitStatus VARCHAR(50) NOT NULL DEFAULT "Active", 
    CreatedDate DATETIME DEFAULT NOW(),
    Streak INT DEFAULT 0,
    CONSTRAINT fk_habits_user
		FOREIGN KEY (UserID)
		REFERENCES habits.Users (UserID)
		ON DELETE CASCADE
		ON UPDATE CASCADE
);


CREATE TABLE HabitLogs (
	HabitLogID INT PRIMARY KEY AUTO_INCREMENT UNIQUE,
    HabitID INT,
    UserID INT,
    DateLogged DATETIME DEFAULT NOW(),
	CompletionStatus VARCHAR(50) NOT NULL,
    CONSTRAINT fk_habitlogs_habit
		FOREIGN KEY (HabitID)
		REFERENCES habits.Habits (HabitID)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT UserID
		FOREIGN KEY (UserID)
		REFERENCES habits.Users (UserID)
		ON DELETE CASCADE
		ON UPDATE CASCADE
);

CREATE TABLE Friendships (
	RequestID INT PRIMARY KEY AUTO_INCREMENT UNIQUE,
    SenderID INT,
    RecipientID INT,
	FriendshipStatus VARCHAR(50) NOT NULL,
    CONSTRAINT SenderID
		FOREIGN KEY (SenderID)
		REFERENCES habits.Users (UserID)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT RecipientID
		FOREIGN KEY (RecipientID)
		REFERENCES habits.Users (UserID)
		ON DELETE CASCADE
		ON UPDATE CASCADE
);

SHOW TABLES;

CREATE USER 'api_user'@'localhost' IDENTIFIED BY 'password101';
GRANT SELECT, INSERT, UPDATE, DELETE ON habits.Users to 'api_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON habits.Habits to 'api_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON habits.HabitLogs to 'api_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON habits.Friendships to 'api_user'@'localhost';
SELECT * FROM INFORMATION_SCHEMA.USER_PRIVILEGES WHERE GRANTEE LIKE "'api_user'@'localhost'";
SHOW GRANTS FOR 'api_user'@'localhost';

INSERT INTO Users(FirstName, LastName, Email, AdminPrivileges, Password)
	VALUES('Akshee', 'Chopra', 'aksheechopra101', 1, '$2b$12$Hxarqk/zmuF7/3HXgFWxveLWALVeZoc8ZC3ypCvqca.FlRFm7PDb2');

SELECT * FROM Users;
