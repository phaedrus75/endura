"""
Basic profanity / objectionable content filter for user-generated text.
Checks against a blocklist of slurs, profanity, and offensive terms.
"""

import re

_BLOCKED_WORDS = {
    "ass", "asshole", "bastard", "bitch", "bollocks", "bugger",
    "bullshit", "cock", "crap", "cunt", "damn", "dick", "dickhead",
    "fag", "faggot", "fuck", "fucker", "fucking", "goddamn",
    "hell", "hoe", "homo", "jerk", "kike", "milf",
    "motherfucker", "nazi", "nigga", "nigger", "penis", "piss",
    "porn", "prick", "pussy", "rape", "retard", "retarded",
    "sex", "sexy", "shit", "slut", "spic", "stfu",
    "tit", "tits", "twat", "vagina", "wanker", "whore", "wtf",
    "kill yourself", "kys",
}

_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in sorted(_BLOCKED_WORDS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


def contains_profanity(text: str) -> bool:
    if not text:
        return False
    return bool(_PATTERN.search(text))


def censor_text(text: str) -> str:
    if not text:
        return text
    def _replace(match: re.Match) -> str:
        word = match.group(0)
        if len(word) <= 2:
            return "*" * len(word)
        return word[0] + "*" * (len(word) - 2) + word[-1]
    return _PATTERN.sub(_replace, text)
