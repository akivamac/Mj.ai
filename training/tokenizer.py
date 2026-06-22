"""
Character-level tokenizer.
Builds a vocab from the training text, encodes/decodes strings.
"""

class Tokenizer:
    def __init__(self):
        self.char_to_id = {}
        self.id_to_char = {}
        self.size = 0

    def build(self, text):
        chars = sorted(set(text))
        self.char_to_id = {c: i for i, c in enumerate(chars)}
        self.id_to_char = {i: c for i, c in enumerate(chars)}
        self.size = len(chars)
        print(f"Vocab size: {self.size} characters")

    def encode(self, text):
        return [self.char_to_id.get(c, 0) for c in text]

    def decode(self, ids):
        return ''.join(self.id_to_char.get(i, '?') for i in ids)

    def save(self, path):
        import json
        with open(path, 'w') as f:
            json.dump({'char_to_id': self.char_to_id, 'id_to_char': {str(k): v for k, v in self.id_to_char.items()}}, f)
        print(f"Tokenizer saved to {path}")

    def load(self, path):
        import json
        with open(path) as f:
            data = json.load(f)
        self.char_to_id = data['char_to_id']
        self.id_to_char = {int(k): v for k, v in data['id_to_char'].items()}
        self.size = len(self.char_to_id)
