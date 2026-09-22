"""
Unit test verifying dynamic STAR framework evaluation end-to-end on mock candidate responses.
"""
import sys
import os

# Add apps/api to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.gemini_service import evaluate_star_framework

def test_star_evaluation_all_present():
    oral = (
        "During my college semester project at HCLTech training, our team worked on a distributed microservice. "
        "My assigned task was to reduce API response latency and fix the memory leak before the upcoming release deadline. "
        "I implemented an asynchronous worker queue in Python with Docker and optimized our database queries with Redis caching. "
        "As a result, we successfully reduced latency by 45 percent and deployed the solution into production with zero defects."
    )
    email = "Dear Lead, Here is my milestone breakdown for the cloud deployment sprint."
    res = evaluate_star_framework(oral, email)
    
    assert res["situation"]["detected"] is True, "Situation should be detected"
    assert res["task"]["detected"] is True, "Task should be detected"
    assert res["action"]["detected"] is True, "Action should be detected"
    assert res["result"]["detected"] is True, "Result should be detected"
    assert "fulfilling all 4 pillars" in res["narrative"]
    print("PASS: test_star_evaluation_all_present")

def test_star_evaluation_missing_task_action():
    oral = (
        "During my college training program, I joined the full-stack batch. "
        "Finally the project was completed and our client satisfaction was high with 95 percent metrics achieved."
    )
    res = evaluate_star_framework(oral, "")
    
    assert res["situation"]["detected"] is True, "Situation should be detected"
    assert res["task"]["detected"] is False, "Task should be missing"
    assert res["action"]["detected"] is False, "Action should be missing"
    assert res["result"]["detected"] is True, "Result should be detected"
    assert "Situation" in res["narrative"]
    assert "Task" in res["narrative"]
    print("PASS: test_star_evaluation_missing_task_action")

def test_star_evaluation_only_action_task():
    oral = (
        "My responsibility was to refactor the authentication module and meet the security objective. "
        "I wrote automated tests in Node.js and configured JWT tokens with PostgreSQL database encryption."
    )
    res = evaluate_star_framework(oral, "")
    
    assert res["situation"]["detected"] is False, "Situation should be missing"
    assert res["task"]["detected"] is True, "Task should be detected"
    assert res["action"]["detected"] is True, "Action should be detected"
    assert res["result"]["detected"] is False, "Result should be missing"
    print("PASS: test_star_evaluation_only_action_task")

def test_star_evaluation_empty():
    res = evaluate_star_framework("", "")
    assert res["situation"]["detected"] is False
    assert res["task"]["detected"] is False
    assert res["action"]["detected"] is False
    assert res["result"]["detected"] is False
    assert "Candidate did not provide" in res["narrative"]
    print("PASS: test_star_evaluation_empty")

if __name__ == "__main__":
    print("Running STAR evaluation test suite...")
    test_star_evaluation_all_present()
    test_star_evaluation_missing_task_action()
    test_star_evaluation_only_action_task()
    test_star_evaluation_empty()
    print("ALL TESTS PASSED SUCCESSFULLY!")
