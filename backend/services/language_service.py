"""
Language detection and ISO mapping service for media items.
Extracts audio and original languages from filenames and TMDB metadata.
"""
import re

ISO_639_1_MAP = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "pa": "Punjabi",
    "gu": "Gujarati",
    "ja": "Japanese",
    "ko": "Korean",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ar": "Arabic",
    "tr": "Turkish",
    "th": "Thai",
    "id": "Indonesian",
    "nl": "Dutch",
    "sv": "Swedish",
    "pl": "Polish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
}

FULL_NAME_REGEX = [
    (r"[\b._\-\s]hindi[\b._\-\s0-9]", "Hindi"),
    (r"[\b._\-\s]english[\b._\-\s0-9]", "English"),
    (r"[\b._\-\s]tamil[\b._\-\s0-9]", "Tamil"),
    (r"[\b._\-\s]telugu[\b._\-\s0-9]", "Telugu"),
    (r"[\b._\-\s]malayalam[\b._\-\s0-9]", "Malayalam"),
    (r"[\b._\-\s]kannada[\b._\-\s0-9]", "Kannada"),
    (r"[\b._\-\s]japanese[\b._\-\s0-9]", "Japanese"),
    (r"[\b._\-\s]korean[\b._\-\s0-9]", "Korean"),
    (r"[\b._\-\s]spanish[\b._\-\s0-9]", "Spanish"),
    (r"[\b._\-\s]french[\b._\-\s0-9]", "French"),
    (r"[\b._\-\s]german[\b._\-\s0-9]", "German"),
    (r"[\b._\-\s]italian[\b._\-\s0-9]", "Italian"),
    (r"[\b._\-\s]russian[\b._\-\s0-9]", "Russian"),
    (r"[\b._\-\s]chinese[\b._\-\s0-9]", "Chinese"),
    (r"[\b._\-\s]punjabi[\b._\-\s0-9]", "Punjabi"),
    (r"[\b._\-\s]bengali[\b._\-\s0-9]", "Bengali"),
    (r"[\b._\-\s]marathi[\b._\-\s0-9]", "Marathi"),
]

SHORT_CODE_REGEX = [
    (r"[\b._\-\s]hin[\b._\-\s0-9]", "Hindi"),
    (r"[\b._\-\s]eng[\b._\-\s0-9]", "English"),
    (r"[\b._\-\s]tam[\b._\-\s0-9]", "Tamil"),
    (r"[\b._\-\s]tel[\b._\-\s0-9]", "Telugu"),
    (r"[\b._\-\s]mal[\b._\-\s0-9]", "Malayalam"),
    (r"[\b._\-\s]kan[\b._\-\s0-9]", "Kannada"),
    (r"[\b._\-\s]kor[\b._\-\s0-9]", "Korean"),
    (r"[\b._\-\s]jap[\b._\-\s0-9]", "Japanese"),
    (r"[\b._\-\s]jpn[\b._\-\s0-9]", "Japanese"),
    (r"[\b._\-\s]spa[\b._\-\s0-9]", "Spanish"),
    (r"[\b._\-\s]fre[\b._\-\s0-9]", "French"),
    (r"[\b._\-\s]ger[\b._\-\s0-9]", "German"),
]


def get_language_name(iso_code: str | None) -> str:
    """Convert an ISO-639-1 code to full language name."""
    if not iso_code:
        return "English"
    code = iso_code.lower().strip()
    return ISO_639_1_MAP.get(code, code.upper())


def extract_media_languages(file_path: str | None, tmdb_original_language: str | None = None) -> list[str]:
    """
    Extract a list of languages for a media item.
    Checks file naming tags (e.g. Hindi, Tamil, Telugu, English) and TMDB original language.
    """
    languages: list[str] = []

    if file_path:
        # Normalize file path for regex check
        normalized = " " + file_path.lower().replace("/", " / ") + " "

        # Check full language names
        for pattern, lang in FULL_NAME_REGEX:
            if re.search(pattern, normalized):
                if lang not in languages:
                    languages.append(lang)

        # Check abbreviations
        for pattern, lang in SHORT_CODE_REGEX:
            if re.search(pattern, normalized):
                if lang not in languages:
                    languages.append(lang)

    # TMDB original language
    if tmdb_original_language:
        orig = get_language_name(tmdb_original_language)
        if orig not in languages:
            languages.insert(0, orig)

    if not languages:
        languages = ["English"]

    return languages
