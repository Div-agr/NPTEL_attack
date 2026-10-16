import json

years = ['2026', '2025', '2024', '2023']
all_questions = []

for y in years:
    with open(f'data_{y}.json', 'r', encoding='utf-8') as f:
        q_list = json.load(f)
        print(f"Loaded {len(q_list)} questions for {y}")
        for q in q_list:
            # Validate
            assert 0 <= q['answer'] < len(q['options']), f"Invalid answer index {q['answer']} in {q['id']}"
            all_questions.append(q)

print(f"Total questions merged: {len(all_questions)}")

# Write to questions.json
with open('questions.json', 'w', encoding='utf-8') as f:
    json.dump(all_questions, f, indent=2)

# Write to questions.js as a global variable ALL_QUESTIONS for seamless zero-config local opening
with open('questions.js', 'w', encoding='utf-8') as f:
    f.write("// NPTEL Psychology of Learning Question Bank\n")
    f.write("// Total questions: " + str(len(all_questions)) + "\n")
    f.write("const ALL_QUESTIONS = " + json.dumps(all_questions, indent=2) + ";\n")

print("Successfully written questions.json and questions.js")
