"""
Proctoring violation tracking and trust scoring.
"""
from typing import Dict, Any, List
from datetime import datetime

class ProctoringTracker:
    def __init__(self):
        self.violations: List[Dict[str, Any]] = []
        self.base_trust_score = 100.0
        
        # Penalties per violation type
        self.penalties = {
            "no_face": 5.0,
            "multiple_faces": 15.0,
            "looking_away": 2.0,
            "tab_switch": 15.0,
            "fullscreen_exit": 10.0,
            "secondary_device": 25.0,
            "copy_paste": 20.0,
            "devtools_open": 30.0
        }

    def add_violation(self, type: str, timestamp: float, details: str = ""):
        """
        Record a proctoring violation.
        """
        self.violations.append({
            "type": type,
            "timestamp": timestamp,
            "details": details,
            "recorded_at": datetime.utcnow().isoformat() + "Z"
        })

    def get_trust_score(self) -> float:
        """
        Calculate the current trust score (0-100) based on recorded violations.
        """
        score = self.base_trust_score
        for v in self.violations:
            penalty = self.penalties.get(v["type"], 5.0)
            score -= penalty
        
        return max(0.0, score)

    def generate_proctoring_report(self) -> Dict[str, Any]:
        """
        Generate a complete report of the proctoring session.
        """
        violation_counts = {}
        for v in self.violations:
            v_type = v["type"]
            violation_counts[v_type] = violation_counts.get(v_type, 0) + 1

        return {
            "trust_score": self.get_trust_score(),
            "total_violations": len(self.violations),
            "violation_counts": violation_counts,
            "violations": self.violations
        }
