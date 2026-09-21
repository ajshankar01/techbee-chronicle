"""
Canonical definition of 35 ITES Cognitive Speed Test Questions (7 Domains)
and 15 Psychometric Assessment Statements (5 Traits).
Used for database seeding, runtime answer scoring, and report auditing.
"""

COGNITIVE_QUESTIONS_DATA = [
    # ── 1. NUMERICAL ABILITY (5 questions) ──
    {
        "id": "cog_1",
        "domain": "NUMERICAL",
        "difficulty": "EASY",
        "subcategory": "Averages",
        "question_text": "A customer care executive handled 40 calls on Monday, 50 calls on Tuesday, and 60 calls on Wednesday. What was the average number of calls handled per day?",
        "options": ["45 calls", "50 calls", "55 calls", "60 calls"],
        "correct_answer_index": 1,
        "explanation": "Average = (40 + 50 + 60) / 3 = 150 / 3 = 50 calls."
    },
    {
        "id": "cog_2",
        "domain": "NUMERICAL",
        "difficulty": "EASY",
        "subcategory": "Discounts",
        "question_text": "A technical certification exam fee is Rs 2,000. An early corporate discount of 15% is applied. What is the net fee payable?",
        "options": ["Rs 1,600", "Rs 1,700", "Rs 1,750", "Rs 1,850"],
        "correct_answer_index": 1,
        "explanation": "Discount = 15% of 2000 = Rs 300. Payable = 2000 - 300 = Rs 1,700."
    },
    {
        "id": "cog_3",
        "domain": "NUMERICAL",
        "difficulty": "MEDIUM",
        "subcategory": "Ratios",
        "question_text": "In an IT service team of 48 engineers, the ratio of Tier-1 support to Tier-2 support is 5:3. How many Tier-1 support engineers are on the team?",
        "options": ["24", "28", "30", "32"],
        "correct_answer_index": 2,
        "explanation": "Total ratio units = 5 + 3 = 8. Tier-1 engineers = (5/8) * 48 = 30."
    },
    {
        "id": "cog_4",
        "domain": "NUMERICAL",
        "difficulty": "MEDIUM",
        "subcategory": "Rates and Output",
        "question_text": "A data operations specialist validates 180 records in 2 hours. At this constant rate, how many records can the specialist validate during an 7-hour shift?",
        "options": ["540 records", "630 records", "680 records", "720 records"],
        "correct_answer_index": 1,
        "explanation": "Rate = 180 / 2 = 90 records/hour. Total in 7 hours = 90 * 7 = 630 records."
    },
    {
        "id": "cog_5",
        "domain": "NUMERICAL",
        "difficulty": "HARD",
        "subcategory": "Compound Reductions",
        "question_text": "An ITES project ticket backlog of 8,000 tickets was reduced by 25% in January, and reduced by another 20% in February. How many unresolved tickets remain at the end of February?",
        "options": ["4,400 tickets", "4,800 tickets", "5,000 tickets", "5,200 tickets"],
        "correct_answer_index": 1,
        "explanation": "After Jan: 8,000 * 0.75 = 6,000. After Feb: 6,000 * 0.80 = 4,800 tickets."
    },

    # ── 2. LOGICAL REASONING (5 questions) ──
    {
        "id": "cog_6",
        "domain": "LOGICAL",
        "difficulty": "EASY",
        "subcategory": "Deduction",
        "question_text": "All project managers have VPN access tokens. Sunita has a VPN access token. Which statement MUST be logically true?",
        "options": [
            "Sunita is definitely a project manager.",
            "Sunita is not a project manager.",
            "Sunita may or may not be a project manager.",
            "All employees with VPN tokens are project managers."
        ],
        "correct_answer_index": 2,
        "explanation": "Having a VPN token is necessary for project managers, but other roles can also have VPN tokens. Sunita may or may not be a project manager."
    },
    {
        "id": "cog_7",
        "domain": "LOGICAL",
        "difficulty": "EASY",
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
        "id": "cog_8",
        "domain": "LOGICAL",
        "difficulty": "MEDIUM",
        "subcategory": "Linear Sequencing",
        "question_text": "Five deployment stages (Alpha, Beta, Gamma, Delta, Epsilon) run sequentially. Gamma finishes before Delta but after Beta. Alpha finishes before Beta. Epsilon finishes last. Which stage finishes 3rd (in the middle)?",
        "options": ["Alpha", "Beta", "Gamma", "Delta"],
        "correct_answer_index": 2,
        "explanation": "Sequence: Alpha -> Beta -> Gamma -> Delta -> Epsilon. Gamma finishes 3rd."
    },
    {
        "id": "cog_9",
        "domain": "LOGICAL",
        "difficulty": "MEDIUM",
        "subcategory": "Direction and Positioning",
        "question_text": "A field engineer walks 20 meters North to Server Rack A, turns East and walks 15 meters to Switch B, then turns South and walks 20 meters to Printer C. In which direction is Printer C from the starting point?",
        "options": ["North", "South", "East", "West"],
        "correct_answer_index": 2,
        "explanation": "North 20m and South 20m cancel out. The engineer is displaced 15 meters East of starting point."
    },
    {
        "id": "cog_10",
        "domain": "LOGICAL",
        "difficulty": "HARD",
        "subcategory": "Truth and Lie Analysis",
        "question_text": "Four agents discuss who resolved a critical bug. Amit says: 'Bikram resolved it.' Bikram says: 'Deepak resolved it.' Charu says: 'I did not resolve it.' Deepak says: 'Bikram is lying.' If exactly ONE of these four statements is TRUE, who resolved the bug?",
        "options": ["Amit", "Bikram", "Charu", "Deepak"],
        "correct_answer_index": 2,
        "explanation": "Bikram and Deepak contradict each other, so exactly one speaks truth. Thus Amit and Charu lie. Since Charu lies saying 'I did not resolve it', Charu resolved the bug."
    },

    # ── 3. VERBAL REASONING (5 questions) ──
    {
        "id": "cog_11",
        "domain": "VERBAL",
        "difficulty": "EASY",
        "subcategory": "Analogies",
        "question_text": "KEYBOARD is to INPUT as DISPLAY is to:",
        "options": ["Storage", "Output", "Processing", "Network"],
        "correct_answer_index": 1,
        "explanation": "A keyboard provides input, while a display provides output."
    },
    {
        "id": "cog_12",
        "domain": "VERBAL",
        "difficulty": "EASY",
        "subcategory": "Workplace Vocabulary",
        "question_text": "In IT service operations, what does the instruction to 'SPEED UP a request' mean?",
        "options": ["Cancel the request", "Finish it faster", "Save it for later", "Send to spam"],
        "correct_answer_index": 1,
        "explanation": "Speed up means to complete or resolve an action faster."
    },
    {
        "id": "cog_13",
        "domain": "VERBAL",
        "difficulty": "MEDIUM",
        "subcategory": "Grammar and Transition",
        "question_text": "The project was finished on time, _______ the team facing database errors during testing.",
        "options": ["because of", "despite", "as a result", "whereas"],
        "correct_answer_index": 1,
        "explanation": "'Despite' denotes that the outcome succeeded regardless of the obstacle."
    },
    {
        "id": "cog_14",
        "domain": "VERBAL",
        "difficulty": "MEDIUM",
        "subcategory": "Antonyms",
        "question_text": "Which word is most OPPOSITE in meaning to 'CLEAR' (honest and open) in team communication?",
        "options": ["Hidden or unclear", "Simple", "Easy to understand", "Direct"],
        "correct_answer_index": 0,
        "explanation": "Hidden or unclear means concealed, non-transparent, or hard to see."
    },
    {
        "id": "cog_15",
        "domain": "VERBAL",
        "difficulty": "HARD",
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

    # ── 4. PATTERN RECOGNITION (5 questions) ──
    {
        "id": "cog_16",
        "domain": "PATTERN",
        "difficulty": "EASY",
        "subcategory": "Arithmetic Progression",
        "question_text": "What is the next number in the sequence: 7, 14, 21, 28, ___?",
        "options": ["32", "35", "36", "42"],
        "correct_answer_index": 1,
        "explanation": "Each term increases by 7: 28 + 7 = 35."
    },
    {
        "id": "cog_17",
        "domain": "PATTERN",
        "difficulty": "EASY",
        "subcategory": "Multiplicative Progression",
        "question_text": "Identify the next number in the sequence: 3, 6, 12, 24, 48, ___?",
        "options": ["72", "84", "96", "108"],
        "correct_answer_index": 2,
        "explanation": "Each term is multiplied by 2: 48 * 2 = 96."
    },
    {
        "id": "cog_18",
        "domain": "PATTERN",
        "difficulty": "MEDIUM",
        "subcategory": "Fibonacci Sum",
        "question_text": "Find the next number in the pattern: 1, 2, 3, 5, 8, 13, ___?",
        "options": ["18", "20", "21", "24"],
        "correct_answer_index": 2,
        "explanation": "Each number is the sum of the two preceding numbers: 8 + 13 = 21."
    },
    {
        "id": "cog_19",
        "domain": "PATTERN",
        "difficulty": "MEDIUM",
        "subcategory": "Letter Symmetry",
        "question_text": "What is the next pair in the pattern: AZ, BY, CX, DW, ___?",
        "options": ["EV", "FU", "EU", "EW"],
        "correct_answer_index": 0,
        "explanation": "First letter goes A->B->C->D->E; second letter goes Z->Y->X->W->V. Result is EV."
    },
    {
        "id": "cog_20",
        "domain": "PATTERN",
        "difficulty": "HARD",
        "subcategory": "Double Difference",
        "question_text": "What number completes the series: 4, 11, 25, 53, ___?",
        "options": ["97", "105", "109", "112"],
        "correct_answer_index": 2,
        "explanation": "Pattern: multiply by 2 and add 3. 53*2+3 = 109."
    },

    # ── 5. PROCESSING SPEED (5 questions) ──
    {
        "id": "cog_21",
        "domain": "PROCESSING",
        "difficulty": "EASY",
        "subcategory": "Rapid Math",
        "question_text": "Calculate quickly: What is (16 × 5) + (24 ÷ 4)?",
        "options": ["84", "86", "88", "92"],
        "correct_answer_index": 1,
        "explanation": "16 * 5 = 80; 24 / 4 = 6; 80 + 6 = 86."
    },
    {
        "id": "cog_22",
        "domain": "PROCESSING",
        "difficulty": "EASY",
        "subcategory": "Magnitude Comparison",
        "question_text": "Which of the following values represents the largest quantity?",
        "options": ["0.65", "3/4", "70%", "0.72"],
        "correct_answer_index": 1,
        "explanation": "3/4 = 0.75, which is greater than 0.72, 0.70, and 0.65."
    },
    {
        "id": "cog_23",
        "domain": "PROCESSING",
        "difficulty": "MEDIUM",
        "subcategory": "Time Calculation",
        "question_text": "A server incident was logged at 10:45 AM and resolved at 03:20 PM on the same day. How long did the resolution take?",
        "options": ["4 hours 15 mins", "4 hours 35 mins", "4 hours 45 mins", "5 hours 05 mins"],
        "correct_answer_index": 1,
        "explanation": "10:45 AM to 2:45 PM = 4 hours. 2:45 PM to 3:20 PM = 35 mins. Total = 4 hours 35 minutes."
    },
    {
        "id": "cog_24",
        "domain": "PROCESSING",
        "difficulty": "MEDIUM",
        "subcategory": "String Verification",
        "question_text": "Compare both server identifiers:\nID 1: [SRV-NODE-99042-MUM]\nID 2: [SRV-NODE-99024-MUM]\nHow do these identifiers differ?",
        "options": [
            "They are completely identical",
            "They differ in the numeric sequence",
            "They differ in the prefix keyword",
            "They differ in the city code"
        ],
        "correct_answer_index": 1,
        "explanation": "ID 1 contains '99042' while ID 2 contains '99024'. Discrepancy is in numeric order."
    },
    {
        "id": "cog_25",
        "domain": "PROCESSING",
        "difficulty": "HARD",
        "subcategory": "Multi-Operator Arithmetic",
        "question_text": "Compute quickly: 140 - (8 × 9) + (72 ÷ 8) - 15 = ?",
        "options": ["62", "65", "68", "72"],
        "correct_answer_index": 0,
        "explanation": "140 - 72 + 9 - 15 = 68 + 9 - 15 = 62."
    },

    # ── 6. ATTENTION TO DETAIL (5 questions) ──
    {
        "id": "cog_26",
        "domain": "ATTENTION",
        "difficulty": "EASY",
        "subcategory": "Exact Matching",
        "question_text": "Find the hardware tag that matches 'NX-58392-KR' EXACTLY:",
        "options": ["NX-58392-KR", "NX-58329-KR", "NX-58392-KP", "MX-58392-KR"],
        "correct_answer_index": 0,
        "explanation": "Option A is a character-by-character identical match."
    },
    {
        "id": "cog_27",
        "domain": "ATTENTION",
        "difficulty": "EASY",
        "subcategory": "List Error Spotting",
        "question_text": "In the following list of badge numbers: [E4019, E4019, E4091, E4019], which item contains a typo?",
        "options": ["Item 1", "Item 2", "Item 3", "Item 4"],
        "correct_answer_index": 2,
        "explanation": "Item 3 has transposed digits: E4091 instead of E4019."
    },
    {
        "id": "cog_28",
        "domain": "ATTENTION",
        "difficulty": "MEDIUM",
        "subcategory": "Transposed Digits",
        "question_text": "Target account code: 'AC-789012-IN'. Which code below contains EXACTLY one pair of swapped digits?",
        "options": ["AC-789012-IN", "AC-780912-IN", "AC-789012-US", "BC-789012-IN"],
        "correct_answer_index": 1,
        "explanation": "In AC-780912-IN, digits 9 and 0 are swapped to 09."
    },
    {
        "id": "cog_29",
        "domain": "ATTENTION",
        "difficulty": "MEDIUM",
        "subcategory": "Address Audit",
        "question_text": "Address A: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201304'\nAddress B: 'HCLTech Campus, Tower 3, Sector 126, Noida, UP 201340'\nWhere is the single difference located?",
        "options": ["Tower number", "Sector number", "Postal PIN code", "State name"],
        "correct_answer_index": 2,
        "explanation": "PIN code is 201304 in Address A vs 201340 in Address B."
    },
    {
        "id": "cog_30",
        "domain": "ATTENTION",
        "difficulty": "HARD",
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

    # ── 7. ABSTRACT REASONING (5 questions) ──
    {
        "id": "cog_31",
        "domain": "ABSTRACT",
        "difficulty": "EASY",
        "subcategory": "Geometric Count",
        "question_text": "If Triangle = 3, Square = 4, and Pentagon = 5, which number corresponds to a Regular Hexagon?",
        "options": ["5", "6", "7", "8"],
        "correct_answer_index": 1,
        "explanation": "A regular hexagon has 6 sides."
    },
    {
        "id": "cog_32",
        "domain": "ABSTRACT",
        "difficulty": "EASY",
        "subcategory": "Symbolic Logic",
        "question_text": "In an automated pipeline rule: # means 'add 3' and * means 'multiply by 2'. Following left-to-right order, what is the output of: 5 # * ?",
        "options": ["13", "16", "18", "20"],
        "correct_answer_index": 1,
        "explanation": "Step 1: 5 + 3 = 8. Step 2: 8 * 2 = 16."
    },
    {
        "id": "cog_33",
        "domain": "ABSTRACT",
        "difficulty": "MEDIUM",
        "subcategory": "Spatial Rotations",
        "question_text": "A directional icon on a network monitor points NORTH. It rotates 90 degrees clockwise, then immediately rotates 180 degrees counter-clockwise. Where does it point now?",
        "options": ["North", "East", "West", "South"],
        "correct_answer_index": 2,
        "explanation": "North + 90 CW = East. East - 180 CCW = West."
    },
    {
        "id": "cog_34",
        "domain": "ABSTRACT",
        "difficulty": "MEDIUM",
        "subcategory": "Matrix Rules",
        "question_text": "In a 3x3 logical matrix:\nRow 1: [2, 4, 8]\nRow 2: [3, 6, 12]\nRow 3: [5, 10, ?]\nWhat is the missing value?",
        "options": ["15", "18", "20", "25"],
        "correct_answer_index": 2,
        "explanation": "Rule across each row: term * 2 = next term. 10 * 2 = 20."
    },
    {
        "id": "cog_35",
        "domain": "ABSTRACT",
        "difficulty": "HARD",
        "subcategory": "Cipher Rule Deduction",
        "question_text": "In an encryption rule, 'BYTE' is coded as 'DZVG' (+2 alphabet shift: B->D, Y->A, T->V, E->G). Under this exact rule, what is the code for 'DATA'?",
        "options": ["FCVC", "FBVB", "EBVC", "FCUB"],
        "correct_answer_index": 0,
        "explanation": "D + 2 = F; A + 2 = C; T + 2 = V; A + 2 = C. Result is FCVC."
    }
]

PSYCHOMETRIC_QUESTIONS_DATA = [
    # ── Adaptability (SA × 2, SD × 1) ─────────────────────────────────
    {
        "id": "psy_1",
        "trait": "Adaptability",
        "ideal_response": "SA",
        "statement_text": "When project plans change suddenly due to client needs, I easily adjust my daily tasks without losing focus."
    },
    {
        "id": "psy_2",
        "trait": "Adaptability",
        "ideal_response": "SA",
        "statement_text": "I feel excited when learning new tools or software to solve a work problem."
    },
    {
        "id": "psy_3",
        "trait": "Adaptability",
        "ideal_response": "SD",
        "statement_text": "I strongly prefer sticking with tools and processes I already know rather than switching to new approaches mid-project."
    },

    # ── Resilience (SA × 2, SD × 2) ───────────────────────────────────
    {
        "id": "psy_4",
        "trait": "Resilience",
        "ideal_response": "SA",
        "statement_text": "When my work has mistakes or needs rework, I take the feedback positively and improve it right away."
    },
    {
        "id": "psy_5",
        "trait": "Resilience",
        "ideal_response": "SA",
        "statement_text": "Under tight deadlines or difficult technical issues, I stay calm and focus on practical solutions."
    },
    {
        "id": "psy_6",
        "trait": "Resilience",
        "ideal_response": "SD",
        "statement_text": "When an unexpected bug or failure occurs in my module, I get discouraged and find it difficult to regain productive momentum."
    },
    {
        "id": "psy_7",
        "trait": "Resilience",
        "ideal_response": "SD",
        "statement_text": "I feel upset and personally hurt when senior teammates point out mistakes or ask for major changes in my work."
    },

    # ── Collaboration (SA × 1, SD × 2) ────────────────────────────────
    {
        "id": "psy_8",
        "trait": "Collaboration",
        "ideal_response": "SA",
        "statement_text": "I actively share helpful notes and guides with teammates to help them succeed, even when I am busy."
    },
    {
        "id": "psy_9",
        "trait": "Collaboration",
        "ideal_response": "SD",
        "statement_text": "I find it annoying when teammates ask questions about my work, because it slows down my personal speed."
    },
    {
        "id": "psy_10",
        "trait": "Collaboration",
        "ideal_response": "SD",
        "statement_text": "I prefer to concentrate only on my own tasks and avoid helping out when team members are struggling with theirs."
    },

    # ── Conscientiousness (SA × 2, SD × 1) ────────────────────────────
    {
        "id": "psy_11",
        "trait": "Conscientiousness",
        "ideal_response": "SA",
        "statement_text": "I double-check my work carefully for mistakes before submitting it for review."
    },
    {
        "id": "psy_12",
        "trait": "Conscientiousness",
        "ideal_response": "SA",
        "statement_text": "I strictly follow security rules, company guidelines, and quality standards in all my daily tasks."
    },
    {
        "id": "psy_13",
        "trait": "Conscientiousness",
        "ideal_response": "SD",
        "statement_text": "When working under tight deadlines, I feel it is fine to skip checking my work or skip notes to finish faster."
    },

    # ── Growth Mindset (SA × 1, SD × 1) ───────────────────────────────
    {
        "id": "psy_14",
        "trait": "Growth Mindset",
        "ideal_response": "SA",
        "statement_text": "I see difficult technical errors as helpful chances to learn and build my understanding."
    },
    {
        "id": "psy_15",
        "trait": "Growth Mindset",
        "ideal_response": "SD",
        "statement_text": "I believe technical ability is something you are born with; people without natural talent rarely succeed even with training."
    }
]
