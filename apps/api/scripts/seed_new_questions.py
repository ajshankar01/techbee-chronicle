import asyncio
import sys
import os

app_dir = r"c:\Users\ajsha\Documents\antigravity\lucid-heisenberg\apps\api"
sys.path.append(app_dir)

from app.core.database import AsyncSessionLocal
from app.models.models import CognitiveQuestion, CognitiveDomain, QuestionDifficulty, QuestionStatus, SessionCognitiveQuestion
from sqlalchemy import delete

QUESTIONS_DATA = [
    # ── 1. NUMERICAL ABILITY (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.NUMERICAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Averages",
        "question_text": "A customer care executive handled 40 calls on Monday, 50 calls on Tuesday, and 60 calls on Wednesday. What was the average number of calls handled per day?",
        "options": ["45 calls", "50 calls", "55 calls", "60 calls"],
        "correct_answer_index": 1,
        "explanation": "Average = (40 + 50 + 60) / 3 = 150 / 3 = 50 calls."
    },
    {
        "domain": CognitiveDomain.NUMERICAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Discounts",
        "question_text": "A technical certification exam fee is Rs 2,000. An early corporate discount of 15% is applied. What is the net fee payable?",
        "options": ["Rs 1,600", "Rs 1,700", "Rs 1,750", "Rs 1,850"],
        "correct_answer_index": 1,
        "explanation": "Discount = 15% of 2000 = Rs 300. Payable = 2000 - 300 = Rs 1,700."
    },
    {
        "domain": CognitiveDomain.NUMERICAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Ratios",
        "question_text": "In an IT service team of 48 engineers, the ratio of Tier-1 support to Tier-2 support is 5:3. How many Tier-1 support engineers are on the team?",
        "options": ["24", "28", "30", "32"],
        "correct_answer_index": 2,
        "explanation": "Total ratio units = 5 + 3 = 8. Tier-1 engineers = (5/8) * 48 = 30."
    },
    {
        "domain": CognitiveDomain.NUMERICAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Rates and Output",
        "question_text": "A data operations specialist validates 180 records in 2 hours. At this constant rate, how many records can the specialist validate during an 7-hour shift?",
        "options": ["540 records", "630 records", "680 records", "720 records"],
        "correct_answer_index": 1,
        "explanation": "Rate = 180 / 2 = 90 records/hour. Total in 7 hours = 90 * 7 = 630 records."
    },
    {
        "domain": CognitiveDomain.NUMERICAL,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Compound Reductions",
        "question_text": "An ITES project ticket backlog of 8,000 tickets was reduced by 25% in January, and reduced by another 20% in February. How many unresolved tickets remain at the end of February?",
        "options": ["4,400 tickets", "4,800 tickets", "5,000 tickets", "5,200 tickets"],
        "correct_answer_index": 1,
        "explanation": "After Jan: 8,000 * 0.75 = 6,000. After Feb: 6,000 * 0.80 = 4,800 tickets."
    },

    # ── 2. LOGICAL REASONING (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.LOGICAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Deduction",
        "question_text": "All project managers have VPN access tokens. Sunita has a VPN access token. Which statement MUST be logically true?",
        "options": [
            "Sunita is definitely a project manager.",
            "Sunita is not a project manager.",
            "Sunita may or may not be a project manager.",
            "All employees with VPN tokens are project managers."
        ],
        "correct_answer_index": 2,
        "explanation": "Having a VPN token is necessary for project managers, but other roles can also have VPN tokens. Therefore, Sunita may or may not be a project manager."
    },
    {
        "domain": CognitiveDomain.LOGICAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Conditionals",
        "question_text": "Rule: 'If an employee passes the compliance test, they receive security clearance.' Fact: Vikas does not have security clearance. What follows logically?",
        "options": [
            "Vikas passed the compliance test.",
            "Vikas did not pass the compliance test.",
            "Vikas forgot his clearance ID.",
            "The compliance test was cancelled."
        ],
        "correct_answer_index": 1,
        "explanation": "Modus Tollens: If P implies Q, then not Q implies not P. Vikas did not pass the compliance test."
    },
    {
        "domain": CognitiveDomain.LOGICAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Linear Sequencing",
        "question_text": "Five deployment stages (Alpha, Beta, Gamma, Delta, Epsilon) run sequentially. Gamma finishes before Delta but after Beta. Alpha finishes before Beta. Epsilon finishes last. Which stage finishes 3rd (in the middle)?",
        "options": ["Alpha", "Beta", "Gamma", "Delta"],
        "correct_answer_index": 2,
        "explanation": "Sequence: Alpha -> Beta -> Gamma -> Delta -> Epsilon. Gamma finishes 3rd."
    },
    {
        "domain": CognitiveDomain.LOGICAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Direction and Positioning",
        "question_text": "A field engineer walks 20 meters North to Server Rack A, turns East and walks 15 meters to Switch B, then turns South and walks 20 meters to Printer C. In which direction is Printer C from the starting point?",
        "options": ["North", "South", "East", "West"],
        "correct_answer_index": 2,
        "explanation": "North 20m and South 20m cancel each other out. The engineer is displaced 15 meters East of the starting point."
    },
    {
        "domain": CognitiveDomain.LOGICAL,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Truth and Lie Analysis",
        "question_text": "Four agents discuss who resolved a critical bug. Amit says: 'Bikram resolved it.' Bikram says: 'Deepak resolved it.' Charu says: 'I did not resolve it.' Deepak says: 'Bikram is lying.' If exactly ONE of these four statements is TRUE, who resolved the bug?",
        "options": ["Amit", "Bikram", "Charu", "Deepak"],
        "correct_answer_index": 2,
        "explanation": "Bikram and Deepak contradict each other, so exactly one of them speaks the truth. Thus Amit and Charu are lying. Since Charu lies when saying 'I did not resolve it', Charu is the one who resolved the bug."
    },

    # ── 3. VERBAL REASONING (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.VERBAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Analogies",
        "question_text": "KEYBOARD is to INPUT as DISPLAY is to:",
        "options": ["Storage", "Output", "Processing", "Network"],
        "correct_answer_index": 1,
        "explanation": "A keyboard provides input, while a display provides output."
    },
    {
        "domain": CognitiveDomain.VERBAL,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Workplace Vocabulary",
        "question_text": "In IT service operations, what does the instruction to 'SPEED UP a request' mean?",
        "options": ["Cancel the request", "Finish it faster", "Save it for later", "Send to spam"],
        "correct_answer_index": 1,
        "explanation": "Speed up means to complete or resolve an action faster."
    },
    {
        "domain": CognitiveDomain.VERBAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Grammar and Transition",
        "question_text": "The project was finished on time, _______ the team facing database errors during testing.",
        "options": ["because of", "despite", "as a result", "whereas"],
        "correct_answer_index": 1,
        "explanation": "'Despite' is the correct preposition denoting that the outcome succeeded regardless of the obstacle."
    },
    {
        "domain": CognitiveDomain.VERBAL,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Antonyms",
        "question_text": "Which word is most OPPOSITE in meaning to 'CLEAR' (honest and open) in team communication?",
        "options": ["Hidden or unclear", "Simple", "Easy to understand", "Direct"],
        "correct_answer_index": 0,
        "explanation": "Hidden or unclear means concealed, non-transparent, or hard to see."
    },
    {
        "domain": CognitiveDomain.VERBAL,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Critical Reading",
        "question_text": "'AI chatbots quickly answer simple questions, but difficult customer problems still need help from experienced human specialists.' What conclusion is directly supported?",
        "options": [
            "AI chatbots will completely replace human workers.",
            "Customers do not like chatbots for simple questions.",
            "Computer tools alone are not enough for difficult customer problems.",
            "Difficult customer problems do not need special experience."
        ],
        "correct_answer_index": 2,
        "explanation": "The passage confirms that difficult problems continue to depend on experienced human specialists."
    },

    # ── 4. PATTERN RECOGNITION (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.PATTERN,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Arithmetic Progression",
        "question_text": "What is the next number in the sequence: 7, 14, 21, 28, ___?",
        "options": ["32", "35", "36", "42"],
        "correct_answer_index": 1,
        "explanation": "Each term increases by 7: 28 + 7 = 35."
    },
    {
        "domain": CognitiveDomain.PATTERN,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Multiplicative Progression",
        "question_text": "Identify the next number in the sequence: 3, 6, 12, 24, 48, ___?",
        "options": ["72", "84", "96", "108"],
        "correct_answer_index": 2,
        "explanation": "Each term is multiplied by 2: 48 * 2 = 96."
    },
    {
        "domain": CognitiveDomain.PATTERN,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Fibonacci Sum",
        "question_text": "Find the next number in the pattern: 1, 2, 3, 5, 8, 13, ___?",
        "options": ["18", "20", "21", "24"],
        "correct_answer_index": 2,
        "explanation": "Each number is the sum of the two preceding numbers: 8 + 13 = 21."
    },
    {
        "domain": CognitiveDomain.PATTERN,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Letter Symmetry",
        "question_text": "What is the next pair in the pattern: AZ, BY, CX, DW, ___?",
        "options": ["EV", "FU", "EU", "EW"],
        "correct_answer_index": 0,
        "explanation": "First letter goes A->B->C->D->E; second letter goes Z->Y->X->W->V. The pair is EV."
    },
    {
        "domain": CognitiveDomain.PATTERN,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Double Difference",
        "question_text": "What number completes the series: 4, 11, 25, 53, ___?",
        "options": ["97", "105", "109", "112"],
        "correct_answer_index": 2,
        "explanation": "Pattern: multiply by 2 and add 3. 4*2+3=11, 11*2+3=25, 25*2+3=53, 53*2+3=109."
    },

    # ── 5. PROCESSING SPEED (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.PROCESSING,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Rapid Math",
        "question_text": "Calculate quickly: What is (16 × 5) + (24 ÷ 4)?",
        "options": ["84", "86", "88", "92"],
        "correct_answer_index": 1,
        "explanation": "16 * 5 = 80; 24 / 4 = 6; 80 + 6 = 86."
    },
    {
        "domain": CognitiveDomain.PROCESSING,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Magnitude Comparison",
        "question_text": "Which of the following values represents the largest quantity?",
        "options": ["0.65", "3/4", "70%", "0.72"],
        "correct_answer_index": 1,
        "explanation": "3/4 = 0.75, which is greater than 0.72, 0.70, and 0.65."
    },
    {
        "domain": CognitiveDomain.PROCESSING,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Time Calculation",
        "question_text": "A server incident was logged at 10:45 AM and resolved at 03:20 PM on the same day. How long did the resolution take?",
        "options": ["4 hours 15 mins", "4 hours 35 mins", "4 hours 45 mins", "5 hours 05 mins"],
        "correct_answer_index": 1,
        "explanation": "10:45 AM to 2:45 PM = 4 hours. 2:45 PM to 3:20 PM = 35 minutes. Total = 4 hours 35 minutes."
    },
    {
        "domain": CognitiveDomain.PROCESSING,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "String Verification",
        "question_text": "Compare both server identifiers:\nID 1: [SRV-NODE-99042-MUM]\nID 2: [SRV-NODE-99024-MUM]\nHow do these identifiers differ?",
        "options": [
            "They are completely identical",
            "They differ in the numeric sequence",
            "They differ in the prefix keyword",
            "They differ in the city code"
        ],
        "correct_answer_index": 1,
        "explanation": "ID 1 contains '99042' while ID 2 contains '99024'. The discrepancy is in the numeric digits."
    },
    {
        "domain": CognitiveDomain.PROCESSING,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Multi-Operator Arithmetic",
        "question_text": "Compute quickly: 140 - (8 × 9) + (72 ÷ 8) - 15 = ?",
        "options": ["62", "65", "68", "72"],
        "correct_answer_index": 0,
        "explanation": "8 * 9 = 72; 72 / 8 = 9. 140 - 72 + 9 - 15 = 68 + 9 - 15 = 62."
    },

    # ── 6. ATTENTION TO DETAIL (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.ATTENTION,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Exact Matching",
        "question_text": "Find the hardware tag that matches 'NX-58392-KR' EXACTLY:",
        "options": ["NX-58392-KR", "NX-58329-KR", "NX-58392-KP", "MX-58392-KR"],
        "correct_answer_index": 0,
        "explanation": "Option A is a character-by-character identical match."
    },
    {
        "domain": CognitiveDomain.ATTENTION,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "List Error Spotting",
        "question_text": "In the following list of badge numbers: [E4019, E4019, E4091, E4019], which item contains a typo?",
        "options": ["Item 1", "Item 2", "Item 3", "Item 4"],
        "correct_answer_index": 2,
        "explanation": "Item 3 has transposed digits: E4091 instead of E4019."
    },
    {
        "domain": CognitiveDomain.ATTENTION,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Transposed Digits",
        "question_text": "Target account code: 'AC-789012-IN'. Which code below contains EXACTLY one pair of swapped digits?",
        "options": ["AC-789012-IN", "AC-780912-IN", "AC-789012-US", "BC-789012-IN"],
        "correct_answer_index": 1,
        "explanation": "In AC-780912-IN, digits 9 and 0 are swapped to 09."
    },
    {
        "domain": CognitiveDomain.ATTENTION,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Address Audit",
        "question_text": "Address A: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201304'\nAddress B: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201340'\nWhere is the single difference located?",
        "options": ["Tower number", "Sector number", "Postal PIN code", "State name"],
        "correct_answer_index": 2,
        "explanation": "PIN code is 201304 in Address A vs 201340 in Address B."
    },
    {
        "domain": CognitiveDomain.ATTENTION,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "System Record Audit",
        "question_text": "Audit the two profile records:\nRecord A: { ID: 'EMP-4482', Email: 'aarav.sharma@hcl.com', Dept: 'FinOps', Grade: 'L1' }\nRecord B: { ID: 'EMP-4482', Email: 'aarav.sharma@hcl.com', Dept: 'Fin0ps', Grade: 'L1' }\nWhat is the specific difference in Record B?",
        "options": [
            "The email address has an added character.",
            "The Department name contains a number '0' instead of letter 'O'.",
            "The employee ID has swapped digits.",
            "Both records are completely identical."
        ],
        "correct_answer_index": 1,
        "explanation": "Record B uses numeral '0' in 'Fin0ps' instead of capital letter 'O'."
    },

    # ── 7. ABSTRACT REASONING (5 questions: 2E, 2M, 1H) ──
    {
        "domain": CognitiveDomain.ABSTRACT,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Geometric Count",
        "question_text": "If Triangle = 3, Square = 4, and Pentagon = 5, which number corresponds to a Regular Hexagon?",
        "options": ["5", "6", "7", "8"],
        "correct_answer_index": 1,
        "explanation": "A regular hexagon has 6 sides."
    },
    {
        "domain": CognitiveDomain.ABSTRACT,
        "difficulty": QuestionDifficulty.EASY,
        "subcategory": "Symbolic Logic",
        "question_text": "In an automated pipeline rule: # means 'add 3' and * means 'multiply by 2'. Following left-to-right order, what is the output of: 5 # * ?",
        "options": ["13", "16", "18", "20"],
        "correct_answer_index": 1,
        "explanation": "Step 1: 5 # = 5 + 3 = 8. Step 2: 8 * = 8 * 2 = 16."
    },
    {
        "domain": CognitiveDomain.ABSTRACT,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Spatial Rotations",
        "question_text": "A directional icon on a network monitor points NORTH. It rotates 90 degrees clockwise, then immediately rotates 180 degrees counter-clockwise. Where does it point now?",
        "options": ["North", "East", "West", "South"],
        "correct_answer_index": 2,
        "explanation": "North + 90 CW = East. East - 180 CCW = West. Final direction is West."
    },
    {
        "domain": CognitiveDomain.ABSTRACT,
        "difficulty": QuestionDifficulty.MEDIUM,
        "subcategory": "Matrix Rules",
        "question_text": "In a 3x3 logical matrix:\nRow 1: [2, 4, 8]\nRow 2: [3, 6, 12]\nRow 3: [5, 10, ?]\nWhat is the missing value?",
        "options": ["15", "18", "20", "25"],
        "correct_answer_index": 2,
        "explanation": "Rule across each row: term * 2 = next term. 5 * 2 = 10; 10 * 2 = 20."
    },
    {
        "domain": CognitiveDomain.ABSTRACT,
        "difficulty": QuestionDifficulty.HARD,
        "subcategory": "Cipher Rule Deduction",
        "question_text": "In an encryption rule, 'BYTE' is coded as 'DZVG' (+2 alphabet shift: B->D, Y->A, T->V, E->G). Under this exact rule, what is the code for 'DATA'?",
        "options": ["FCVC", "FBVB", "EBVC", "FCUB"],
        "correct_answer_index": 0,
        "explanation": "D + 2 = F; A + 2 = C; T + 2 = V; A + 2 = C. Result is FCVC."
    }
]

async def seed_questions():
    async with AsyncSessionLocal() as session:
        await session.execute(delete(SessionCognitiveQuestion))
        await session.execute(delete(CognitiveQuestion))
        await session.commit()
        
        cog_questions = []
        for q in QUESTIONS_DATA:
            cog_questions.append(CognitiveQuestion(
                domain=q["domain"],
                difficulty=q["difficulty"],
                subcategory=q.get("subcategory", f"{q['domain'].value}_CORE"),
                question_text=q["question_text"],
                options=q["options"],
                correct_answer_index=q["correct_answer_index"],
                explanation=q.get("explanation", ""),
                status=QuestionStatus.ACTIVE,
                estimated_time=35,
                is_active=True
            ))
        
        session.add_all(cog_questions)
        await session.commit()
        print(f"SUCCESS: Seeded {len(cog_questions)} real ITES Cognitive Questions across all 7 domains!")

if __name__ == "__main__":
    asyncio.run(seed_questions())
