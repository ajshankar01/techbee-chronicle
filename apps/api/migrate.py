import sqlite3
import os

def run_migration():
    db_path = "techbee_interviews.db"
    if not os.path.exists(db_path):
        print("Database file not found yet. Uvicorn will create it upon startup.")
        return

    print("Running migration on", db_path)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Migrate candidates table
    cursor.execute("PRAGMA table_info(candidates);")
    candidate_cols = [row[1] for row in cursor.fetchall()]
    print("Candidates table columns:", candidate_cols)
    if "join_date" not in candidate_cols:
        print("Adding candidates.join_date...")
        cursor.execute("ALTER TABLE candidates ADD COLUMN join_date DATETIME DEFAULT '2026-08-21 00:00:00';")
    if "current_bond_year" not in candidate_cols:
        print("Adding candidates.current_bond_year...")
        cursor.execute("ALTER TABLE candidates ADD COLUMN current_bond_year INTEGER DEFAULT 1;")

    # 2. Migrate interview_sessions table
    cursor.execute("PRAGMA table_info(interview_sessions);")
    session_cols = [row[1] for row in cursor.fetchall()]
    print("Interview sessions table columns:", session_cols)
    if "bond_year" not in session_cols:
        print("Adding interview_sessions.bond_year...")
        cursor.execute("ALTER TABLE interview_sessions ADD COLUMN bond_year INTEGER DEFAULT 1;")
    if "parent_session_id" not in session_cols:
        print("Adding interview_sessions.parent_session_id...")
        cursor.execute("ALTER TABLE interview_sessions ADD COLUMN parent_session_id CHAR(36);")

    # 3. Migrate analysis_results table
    cursor.execute("PRAGMA table_info(analysis_results);")
    analysis_cols = [row[1] for row in cursor.fetchall()]
    print("Analysis results table columns:", analysis_cols)
    if "profile_snapshot" not in analysis_cols:
        print("Adding analysis_results.profile_snapshot...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN profile_snapshot TEXT;")
    if "longitudinal_trends" not in analysis_cols:
        print("Adding analysis_results.longitudinal_trends...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN longitudinal_trends TEXT;")
    # Advanced Intelligence columns (A–D feature set)
    if "advanced_behavioral_json" not in analysis_cols:
        print("Adding analysis_results.advanced_behavioral_json...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN advanced_behavioral_json TEXT;")
    if "advanced_longitudinal_json" not in analysis_cols:
        print("Adding analysis_results.advanced_longitudinal_json...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN advanced_longitudinal_json TEXT;")
    if "advanced_psychological_json" not in analysis_cols:
        print("Adding analysis_results.advanced_psychological_json...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN advanced_psychological_json TEXT;")
    if "advanced_report_json" not in analysis_cols:
        print("Adding analysis_results.advanced_report_json...")
        cursor.execute("ALTER TABLE analysis_results ADD COLUMN advanced_report_json TEXT;")

    conn.commit()
    conn.close()
    print("Database migration check completed successfully.")


if __name__ == "__main__":
    run_migration()
