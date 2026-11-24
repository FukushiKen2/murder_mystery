"""Server-side room state and scoring. Scenario-specific answers stay in private data."""

from collections import Counter
from unicodedata import normalize

ROLES = ('ロラン', 'ディアナ', 'キエル', 'ハリー', 'コレン', 'グエン')
PHASES = ('入室待ち', '第1章', '第2章', '第3章・最終討論', '個別推理', '犯人投票', '出発選択', 'エンディング')


class Room:
    def __init__(self, cards, rules):
        self.cards = cards
        self.rules = rules
        self.phase = 0
        self.joined = set()
        self.read = set()
        self.owners = {}
        self.public = set()
        self.viewers = {}
        self.offers = {}
        self.history = []
        self.picks = Counter()
        self.answers = {}
        self.votes = {}
        self.consents = set()
        self.detained = None
        self.restored = False
        self.leaves = False
        self.passengers = ()
        self.facts = None

    def unlocked(self, key):
        return self.phase >= 1 and (not key.startswith('S2-') or self.phase >= 2)

    def visible(self, role, key):
        return role == -1 or key in self.public or role in self.viewers.get(key, ())

    def remaining(self, role):
        return 2 - self.picks[self.phase, role]

    def can_investigate(self, role, key):
        return (role >= 0 and self.phase in (1, 2) and self.unlocked(key)
                and key not in self.owners and self.remaining(role) > 0
                and not (key.startswith('I-') and (int(key[2:]) - 1) // 2 == role))

    def advance(self, confirmed):
        if self.phase == 0 and len(self.joined) < len(ROLES):
            return False
        if self.phase in (1, 2) and not confirmed and any(self.remaining(i) for i in range(len(ROLES))):
            return False
        if self.phase == 4 and len(self.answers) < len(ROLES):
            return False
        if self.phase >= 5:
            return False
        self.phase += 1
        return True

    def card_action(self, role, action, key, target):
        if role < 0 or key not in self.cards or not 1 <= self.phase <= 5:
            return False
        if action == 'investigate' and self.can_investigate(role, key):
            self.owners[key] = role
            self.viewers[key] = {role}
            self.picks[self.phase, role] += 1
        elif action == 'accept' and self.offers.get(key) == (self.owners.get(key), role):
            self.owners[key] = role
            self.viewers[key].add(role)
            del self.offers[key]
        elif self.owners.get(key) != role:
            return False
        elif action == 'publish' and key not in self.public:
            self.public.add(key)
        elif action == 'cancel' and key in self.offers:
            del self.offers[key]
        elif action in ('offer', 'share') and target in range(len(ROLES)) and target != role:
            if action == 'offer':
                if key in self.offers:
                    return False
                self.offers[key] = (role, target)
            elif target not in self.viewers[key] and key not in self.public:
                self.viewers[key].add(target)
            else:
                return False
        else:
            return False
        self.history.append((role, action, key, target))
        return True

    def vote(self, role, target):
        if self.phase != 5 or role in self.votes or target not in range(len(ROLES)) or target == role:
            return False
        self.votes[role] = target
        if len(self.votes) == len(ROLES):
            counts = Counter(self.votes.values())
            leaders = [candidate for candidate, n in counts.items() if n == max(counts.values())]
            self.detained = leaders[0] if len(leaders) == 1 else None
            self.restored = sum(self.owners.get(card) == 0 for card in self.rules['records']) >= 2
            self.offers.clear()
            self.phase = 6
        return True

    def finish(self, leaves, passengers):
        if (self.phase != 6 or self.detained in passengers or len(passengers) > 2 or len(set(passengers)) != len(passengers)
                or not set(passengers) <= self.consents or (not leaves and passengers)
                or (leaves and self.detained == 0)):
            return False
        self.leaves = leaves
        self.passengers = tuple(passengers)
        self.phase = 7
        return True

    @property
    def safe(self):
        return self.leaves and self.restored

    def scores(self):
        if self.facts is None:
            return None
        def points(role, goal):
            kind, value, weight = goal
            if kind == 'arrived':
                passed = self.safe and value in self.passengers
            elif kind == 'answer':
                answer = normalize('NFKC', self.answers.get(role, '')).replace(' ', '')
                passed = answer in value
            elif kind == 'detained':
                passed = self.detained == value
            elif kind == 'free':
                passed = self.detained != role
            elif kind == 'restored':
                passed = self.restored
            elif kind == 'owns':
                passed = any(self.owners.get(key) == role for key in value)
            elif kind == 'kept_secret':
                passed = not self.facts[value]
            elif kind == 'promise':
                passed = self.facts['promise'] and self.facts['governor'] is not None
            elif kind == 'governs_after_return':
                if self.safe and value in self.passengers and self.facts['governor'] == role:
                    return weight // 2 if self.facts['swap'] else weight
                passed = False
            elif kind == 'governs_on_moon':
                passed = self.facts['governor'] == value and not (self.leaves and value in (0, *self.passengers))
            else:
                raise ValueError('未対応の得点条件')
            return weight if passed else 0
        return [sum(points(role, goal) for goal in goals) for role, goals in enumerate(self.rules['goals'])]
