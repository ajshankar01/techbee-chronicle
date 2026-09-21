import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import QuestionBank, QuestionType

logger = logging.getLogger(__name__)

SEEDED_QUESTIONS = [
    # ── PSYCHOMETRIC (15 questions) ──
    {"type": QuestionType.PSYCHOMETRIC, "text": "What is a major professional mistake you made, and what did you learn about yourself from it?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "How do you handle conflicts between your personal values and a business decision at work?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "What drives you to write clean, secure code even when nobody is actively reviewing it?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "Describe a time you admitted a mistake to your manager before anyone else noticed. What was their reaction?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "How do you handle a teammate who is struggling with their tasks and falling behind?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "What does 'workplace integrity' mean to you in the context of handling user data and security?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "Tell me about a time you had to prioritize team success over your own personal recognition."},
    {"type": QuestionType.PSYCHOMETRIC, "text": "How do you handle stress when you realize you made a mistake that caused a production outage?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "What is your approach to dealing with biases when reviewing another developer's pull request?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "Describe a time you stood up for a teammate who was being treated unfairly in a discussion."},
    {"type": QuestionType.PSYCHOMETRIC, "text": "How do you define accountability in software development? Give an example of how you practice it."},
    {"type": QuestionType.PSYCHOMETRIC, "text": "What is your strategy for delivering constructive feedback to someone who is highly sensitive?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "How do you maintain a positive ethical_decision_making when working on a project that is failing?"},
    {"type": QuestionType.PSYCHOMETRIC, "text": "Tell me about a time you went out of your way to help a junior colleague understand a core concept."},
    {"type": QuestionType.PSYCHOMETRIC, "text": "What is your reaction when a feature you built is heavily criticized during a team demo?"},

    # ── ENDURANCE (15 questions) ──
    {"type": QuestionType.ENDURANCE, "text": "How do you maintain your focus and energy during a high-stress deployment that goes late into the night?"},
    {"type": QuestionType.ENDURANCE, "text": "Describe a time when you had to work through a series of repetitive database migrations. How did you stay motivated?"},
    {"type": QuestionType.ENDURANCE, "text": "When a critical system goes down and customers are complaining, how do you manage your anxiety and work systematically?"},
    {"type": QuestionType.ENDURANCE, "text": "Describe a project that took months to finish. How did you maintain momentum and interest over that time?"},
    {"type": QuestionType.ENDURANCE, "text": "How do you handle receiving harsh, critical reviews on a pull request you spent days preparing?"},
    {"type": QuestionType.ENDURANCE, "text": "Tell me about a time when you had to work under a manager who micro-managed. How did you adapt?"},
    {"type": QuestionType.ENDURANCE, "text": "What do you do when you are stuck on a difficult bug for more than 6 hours without progress?"},
    {"type": QuestionType.ENDURANCE, "text": "How do you balance learning new frameworks on weekends while handling a demanding full-time workload?"},
    {"type": QuestionType.ENDURANCE, "text": "Describe a time when your code failed in production immediately after launch. How did you react?"},
    {"type": QuestionType.ENDURANCE, "text": "How do you keep yourself motivated when working on legacy codebase code with minimal documentation?"},
    {"type": QuestionType.ENDURANCE, "text": "Tell me about a time you had to pull long hours to meet a critical deadline. What did you learn?"},
    {"type": QuestionType.ENDURANCE, "text": "How do you maintain quality and test coverage when you are rushed to ship a feature?"},
    {"type": QuestionType.ENDURANCE, "text": "What is your process for managing your mental well-being and preventing burnout during peak quarters?"},
    {"type": QuestionType.ENDURANCE, "text": "Describe a situation where your team was understaffed and you had to take on double the workload."},
    {"type": QuestionType.ENDURANCE, "text": "How do you handle working on a feature that you personally think is useless or poorly designed?"},

    # ── COGNITIVE_ABILITY (15 questions) ──
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "Explain how you would estimate the number of active API requests HCL handles globally in one second."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "A server's response time suddenly doubles, but CPU usage is normal and memory is low. What logical steps do you take to isolate the bottleneck?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "You are given an unsorted array of numbers from 1 to 100 with one number missing. Describe your method to find the missing number in linear time."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "How do you explain the difference between linear search and binary search to someone who doesn't code?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "A cache eviction policy needs to be chosen for a database with highly repetitive but time-decaying reads. What caching strategy would you propose and why?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "A system needs to process millions of transactions per day, and some are duplicates. Describe how a Bloom filter can help reduce duplicate lookups efficiently."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "Explain how you would design a high-level logical architecture for a system that coordinates thousands of delivery riders in real time."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "Describe the difference between compile-time errors and runtime errors, and how you logically debug each."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "You need to sort a large list of names. If memory consumption is your primary constraint, which sorting algorithm would you choose and why?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "How does a compiler or interpreter parse code? Explain the role of abstract syntax trees (ASTs) in simple terms."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "A database query is running slow because of a missing index. Explain what database indexing does under the hood to speed up search."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "How would you handle a memory leak in a production environment? Explain how you logically track down memory bloat."},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "Describe the logic behind OAuth authentication. How does a client get permission to access resources without knowing the user's password?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "What is the purpose of database normalization, and when would you deliberately choose to denormalize tables?"},
    {"type": QuestionType.COGNITIVE_ABILITY, "text": "Explain how the TCP handshake works and why it is critical for reliable network transmission."},

    # ── FORENSIC_ANALYSIS (15 questions) ──
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A secure system database was wiped at 3 AM. The logs show three entries: an automated cron job, a senior dev's admin credentials, and a guest session. How do you start your forensic investigation?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A suspect claims they were offline during a security breach, but their email client shows a draft folder sync timestamp matching the breach. What other logs would you cross-reference to verify their alibi?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "An audit log has a sequence gap (log #1004 is followed by #1006). The system admin claims it's a minor database auto-increment glitch. What forensic evidence would you look for to prove it was manually tampered with?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "You find an encrypted archive hidden inside a jpeg image file on a corporate server. Explain how you would identify this steganography and extract the hidden data."},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A server has been infected with ransomware, but only files created in the last 24 hours are locked. The attacker claims they have full system access. How would you investigate if the breach is local or network-based?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A proprietary database file was leaked. The timestamp of the file matches a backup script runtime, but the backup server was shutdown. How do you check if the database was exfiltrated via local USB?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "During a breach, a hacker modified a system binary. The file modification date is unchanged, but the hash value is different. How would you detect this, and what steps would you take to restore integrity?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A senior admin account was compromised, but the admin claims they never shared their MFA key. How would you investigate a session hijacking or cookie theft attack on their browser?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "An anonymous email containing company secrets was sent to a competitor. The email headers show a server IP address, but the server logs for that IP are wiped. How do you recover the sender's details?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A developer committed a backdoor into the production codebase under a fake Git author name. How would you trace the actual committer using Git signatures and SSH logs?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "An external hacker gained access to a database via SQL injection. The query logs show no malicious strings. Explain how they might have used blind SQL injection, and how you would find the evidence."},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A high-security VM was cloned and run on a different host. What forensic indicators in the OS metadata or network logs would reveal that the machine is a clone?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A network switch was reconfigured to redirect traffic. The admin logs show no login activity. What physical or logical entry points would you audit to find how the config was changed?"},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A file containing password hashes was accessed, but the access times are identical to the creation time. Explain how a hacker could access a file without updating its last-accessed timestamp."},
    {"type": QuestionType.FORENSIC_ANALYSIS, "text": "A server logs a series of failed login attempts from localhost, followed by a successful login. How do you investigate if an internal service was exploited for privilege escalation?"},

    # ── ADAPTABILITY (15 questions) ──
    {"type": QuestionType.ADAPTABILITY, "text": "Tell me about a time you had to learn a completely new database technology (e.g. SQL to NoSQL) in under a week."},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you approach a task when the requirements are vague and the client is unsure what they want?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Describe a situation where you had to pivot your implementation mid-sprint due to an external API change."},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you handle taking over legacy code from a developer who has left the company without hand-off documentation?"},
    {"type": QuestionType.ADAPTABILITY, "text": "What is your strategy for adapting to a new team structure or organizational change?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Describe a time you had to drop your current task to immediately fix a production blocker. How did you manage context switching?"},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you handle it when a tool you rely on daily is suddenly deprecated or banned by security policy?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Tell me about a time you worked on a project where the target platform changed (e.g. Web to Mobile) late in the cycle."},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you adapt your coding style when working with a team that has strict, opinionated guidelines different from yours?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Describe a time you had to implement a feature using a library with absolutely zero documentation or examples."},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you handle working in a foreign codebase (e.g. shifting from frontend to backend tasks)?"},
    {"type": QuestionType.ADAPTABILITY, "text": "What steps do you take when a feature you designed is rendered obsolete by a new third-party integration?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Describe a time you adapted to a project that suddenly switched its methodology from Kanban to Scrum."},
    {"type": QuestionType.ADAPTABILITY, "text": "How do you handle shifts in project deadlines when they are moved up by several weeks?"},
    {"type": QuestionType.ADAPTABILITY, "text": "Tell me about a time you solved a bug by using a creative, non-standard workaround when the standard way failed."},

    # ── COMMUNICATION (15 questions) ──
    {"type": QuestionType.COMMUNICATION, "text": "How do you explain a highly technical bug to a non-technical manager? Walk me through your approach."},
    {"type": QuestionType.COMMUNICATION, "text": "Tell me about a time when you had to disagree with a senior developer. How did you communicate your opinion?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you structure your arguments when pitching a new architecture style to your team?"},
    {"type": QuestionType.COMMUNICATION, "text": "Describe a situation where you had to deliver critical feedback to a peer. How did you ensure it was constructive?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you handle a meeting where stakeholders have conflicting requirements?"},
    {"type": QuestionType.COMMUNICATION, "text": "Describe a time when you had to explain a complex data flow using a simple analogy."},
    {"type": QuestionType.COMMUNICATION, "text": "What is your approach to writing clear, readable code comments and documentation?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you ensure you stay aligned with remote team members across different time zones?"},
    {"type": QuestionType.COMMUNICATION, "text": "Tell me about a time you had to write a post-mortem or incident report. How did you structure it?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you verify that your client has understood your proposed solution before starting development?"},
    {"type": QuestionType.COMMUNICATION, "text": "Describe a time when active listening helped you resolve a major issue in a project."},
    {"type": QuestionType.COMMUNICATION, "text": "What steps do you take when you realize you won't be able to deliver a task on time?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you present technical trade-offs (e.g. speed vs quality) to business product owners?"},
    {"type": QuestionType.COMMUNICATION, "text": "Tell me about a time when a lack of vision_alignment led to a project failure. How did you fix it?"},
    {"type": QuestionType.COMMUNICATION, "text": "How do you manage constant distractions (emails, Slack) while attempting deep-focus coding?"},

    # ── TEAM_MANAGEMENT (15 questions) ──
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you resolve interpersonal conflicts between two members of your team?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "Describe a time when you had to take over a team that was underperforming. How did you turn things around?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you ensure that all team members feel their ideas are heard and valued?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "What is your approach to delegating tasks to junior developers versus senior developers?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you onboard a new team member effectively while keeping the rest of the team productive?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "Describe a situation where you had to build consensus among team members with differing technical opinions."},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you handle a situation where one team member is not contributing their fair share of the work?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "What metrics or indicators do you use to gauge the health and morale of your team?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "Tell me about a time you had to deliver difficult performance feedback to a direct report."},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you balance managing the team's workload with allowing time for learning and innovation?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "Describe your strategy for running effective team meetings that don't waste time."},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you handle a high-performing team member who is toxic to the team's culture?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "What is your approach to resolving resource constraints when your team is over-committed?"},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "Tell me about a time you advocated for your team's needs to upper management."},
    {"type": QuestionType.TEAM_MANAGEMENT, "text": "How do you foster a culture of continuous improvement and feedback within your team?"},

    # ── LEADERSHIP_QUALITY (15 questions) ──
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Describe a time when you had to lead a project without formal authority over the team members."},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you inspire a team to commit to a challenging goal that seems almost impossible?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "What is the most difficult leadership decision you've had to make, and what was the outcome?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you handle situations where you need to make a decision but lack critical information?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Describe a time when your leadership was questioned. How did you respond and re-establish trust?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you identify and develop potential leaders within your team?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Tell me about a time you had to change your leadership style to suit a specific situation or team."},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you balance the need to achieve short-term results with long-term strategic goals?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Describe a time you took the blame for a team failure to protect your team from upper management."},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you maintain a positive and resilient attitude when facing a major crisis?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "What is your approach to empowering your team members to take ownership of their work?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Tell me about a time you had to rally a demotivated team after a significant setback."},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you ensure that your leadership decisions are transparent and understood by your team?"},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "Describe a situation where you had to mediate a conflict between your team and another department."},
    {"type": QuestionType.LEADERSHIP_QUALITY, "text": "How do you evaluate your own effectiveness as a leader and seek improvement?"},

    # ── VISION_AND_MISSION (15 questions) ──
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you align your team's daily tasks with the broader strategic vision of the company?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Describe a time when you had to communicate a major change in company direction to a skeptical team."},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you ensure that a long-term project stays true to its original mission over several months?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "What strategies do you use to help your team understand the 'why' behind what they are building?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Tell me about a time you identified a misalignment between a project's goals and the company's mission. What did you do?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you incorporate the company's core values into your team's decision-making process?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Describe a situation where you had to push back on a feature request because it didn't align with the product vision."},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you keep a team focused on the big picture when they are bogged down by immediate technical challenges?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Tell me about a time you successfully pitched a visionary idea to stakeholders. What was your approach?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you measure whether a project successfully achieved its intended mission or impact?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Describe a time you had to pivot a project's direction entirely to better align with a new corporate strategy."},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you foster a sense of purpose and mission-driven motivation within a technical team?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "What is your approach to handling a situation where stakeholders have conflicting visions for a product?"},
    {"type": QuestionType.VISION_AND_MISSION, "text": "Tell me about a time you translated a high-level, abstract vision into actionable, concrete goals for your team."},
    {"type": QuestionType.VISION_AND_MISSION, "text": "How do you ensure that new team members quickly understand and embrace the team's mission?"}
]

async def seed_question_bank(db: AsyncSession):
    """Seed questions into the question_bank table and default candidates if they're empty."""
    logger.info("🌱 Seeding missing questions into TechBee Question Bank...")
    
    # Assign tags to SEEDED_QUESTIONS dynamically based on category index
    counts = {}
    for q in SEEDED_QUESTIONS:
        q_type = q["type"]
        counts[q_type] = counts.get(q_type, 0) + 1
        category_index = counts[q_type] - 1
        
        if q_type == QuestionType.FORENSIC_ANALYSIS:
            if category_index < 10:
                q["tags"] = {"bond_year": 2, "difficulty": "medium"}
            else:
                q["tags"] = {"bond_year": 3, "difficulty": "hard"}
        else:
            if category_index < 7:
                q["tags"] = {"bond_year": 1, "difficulty": "easy"}
            elif category_index < 14:
                q["tags"] = {"bond_year": 2, "difficulty": "medium"}
            else:
                q["tags"] = {"bond_year": 3, "difficulty": "hard"}

    # Batch fetch all existing question texts in one query (avoids 75+ round-trips to RDS)
    existing_res = await db.execute(select(QuestionBank.question_text, QuestionBank))
    existing_map = {row[0]: row[1] for row in existing_res.all()}

    added_count = 0
    updated_count = 0
    for q_data in SEEDED_QUESTIONS:
        q_text = q_data["text"]
        existing_qb = existing_map.get(q_text)
        
        tags = {"domain": "general", "seeded": True}
        if "tags" in q_data:
            tags.update(q_data["tags"])
            
        if not existing_qb:
            qb = QuestionBank(
                question_type=q_data["type"],
                question_text=q_text,
                tags=tags,
                is_active=True
            )
            db.add(qb)
            added_count += 1
        else:
            # Update tags of existing seeded questions to ensure they have the new difficulty/bond_year tags
            curr_tags = dict(existing_qb.tags) if existing_qb.tags else {}
            if "bond_year" not in curr_tags:
                curr_tags.update(tags)
                existing_qb.tags = curr_tags
                db.add(existing_qb)
                updated_count += 1

    
    if added_count > 0 or updated_count > 0:
        logger.info(f"✅ Seeding finished: added {added_count}, updated tags for {updated_count} questions.")
    else:
        logger.info("ℹ️ Question bank already has all seeded questions. Skipping.")

    # Check if candidates exist
    from app.models.models import Candidate, HRUser, UserRole, InterviewSession, SessionStatus, AnalysisResult
    import uuid
    from datetime import datetime, timedelta, timezone

    c_result = await db.execute(select(Candidate))
    c_exists = c_result.scalars().first()
    
    if not c_exists:
        logger.info("🌱 Seeding default candidates and mock Year 1 history...")
        
        # 1. Ensure at least one HR User exists for foreign key constraints
        hr_result = await db.execute(select(HRUser))
        hr_user = hr_result.scalars().first()
        if not hr_user:
            hr_user = HRUser(
                id=uuid.UUID("d3b07384-d113-4ef6-a5db-3c58ded506e7"),
                azure_oid="default-hr-oid",
                email="hr.manager@techbee.in",
                display_name="HR Manager",
                role=UserRole.HR_MANAGER
            )
            db.add(hr_user)
            await db.flush()

        # 2. Seed Candidates
        priya = Candidate(
            azure_oid="demo-oid-priya",
            display_name="Priya Sharma",
            email="priya.sharma@techbee.in",
            batch_year=2026,
            employee_id="SAP99011",
            is_active=True,
            current_bond_year=2  # Candidate is now in Year 2
        )
        arjun = Candidate(
            azure_oid="demo-oid-arjun",
            display_name="Arjun Mehta",
            email="arjun.mehta@techbee.in",
            batch_year=2026,
            employee_id="SAP99012",
            is_active=True,
            current_bond_year=1
        )
        kavya = Candidate(
            azure_oid="demo-oid-kavya",
            display_name="Kavya Reddy",
            email="kavya.reddy@techbee.in",
            batch_year=2026,
            employee_id="SAP99013",
            is_active=True,
            current_bond_year=1
        )
        db.add(priya)
        db.add(arjun)
        db.add(kavya)
        await db.flush()

        # 3. Seed Completed Year 1 Session for Priya Sharma
        y1_session = InterviewSession(
            candidate_id=priya.id,
            created_by_hr_id=hr_user.id,
            status=SessionStatus.COMPLETED,
            bond_year=1,
            started_at=datetime.now(timezone.utc) - timedelta(days=365),
            ended_at=datetime.now(timezone.utc) - timedelta(days=365, minutes=15),
            duration_seconds=900,
            notes="Completed Year 1 soft skills baseline.",
        )
        db.add(y1_session)
        await db.flush()

        # 4. Seed Analysis Result with Year 1 Profile Snapshot
        y1_analysis = AnalysisResult(
            session_id=y1_session.id,
            overall_score=78.0,
            domain_recommendation="Full-Stack Web Development",
            secondary_domain="Cloud Infrastructure",
            summary_text="Priya demonstrated solid software engineering concepts and clear vision_alignment. She expressed a goal to master cloud-native deployments.",
            profile_snapshot={
                "vision": "Become a senior technical lead managing cloud infrastructure and Full-Stack React/Python deployments",
                "goals": [
                    "Master containerization (Docker/Kubernetes)",
                    "Improve public speaking and vision_alignment with corporate stakeholders"
                ],
                "weaknesses": [
                    "Hesitancy when challenged on scaling decisions",
                    "Needs more quantitative results in project reports"
                ],
                "domain": "Full-Stack Web Development"
            },
            analyzed_at=datetime.now(timezone.utc) - timedelta(days=365)
        )
        db.add(y1_analysis)
        logger.info("✅ Default candidates and Priya Year 1 longitudinal history seeded successfully!")
        
    await db.commit()
