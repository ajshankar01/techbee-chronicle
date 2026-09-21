import psycopg2

DATABASE_URL_SYNC = "postgresql://chronicle_admin:Techbeechronicle%232026@techbee-interview-questions-db.cxoiosyc6jjf.ap-southeast-2.rds.amazonaws.com:5432/postgres"

def main():
    columns_to_add = {
        "vision_alignment_score": "FLOAT",
        "emotional_intelligence_score": "FLOAT",
        "stress_tolerance_score": "FLOAT",
        "adaptability_score": "FLOAT",
        "team_collaboration_score": "FLOAT",
        "ethical_decision_making_score": "FLOAT",
        "advanced_behavioral_json": "JSON",
        "advanced_longitudinal_json": "JSON",
        "advanced_psychological_json": "JSON",
        "advanced_report_json": "JSON"
    }
    
    try:
        conn = psycopg2.connect(DATABASE_URL_SYNC)
        conn.autocommit = True
        with conn.cursor() as cur:
            for col, dtype in columns_to_add.items():
                try:
                    cur.execute(f"ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS {col} {dtype};")
                    print(f"Added {col}")
                except Exception as e:
                    print(f"Failed to add {col}: {e}")
            print("Successfully finished adding columns.")
    except Exception as e:
        print(f"Error connecting: {e}")

if __name__ == "__main__":
    main()
