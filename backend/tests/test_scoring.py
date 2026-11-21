import pytest

from app.domain.scoring import lower_median, suggest_level


def test_odd_count_median():
    s = suggest_level([2, 5, 3])
    assert s.suggested_level == 3
    assert s.rated_levels == [2, 3, 5]
    assert s.rated == 3 and s.no_basis == 0


def test_even_count_takes_lower():
    s = suggest_level([3, 4])
    assert s.suggested_level == 3
    assert "niższą" in s.explanation


def test_even_count_equal_middle_no_tie_note():
    s = suggest_level([2, 4, 4, 5])
    assert s.suggested_level == 4
    assert "niższą" not in s.explanation


def test_skips_no_basis():
    s = suggest_level([None, 5, None, 1, 4])
    assert s.suggested_level == 4
    assert s.no_basis == 2
    assert s.rated == 3
    assert "Pominięto 2" in s.explanation


def test_all_no_basis():
    s = suggest_level([None, None])
    assert s.suggested_level is None
    assert s.no_basis == 2


def test_empty():
    assert suggest_level([]).suggested_level is None


def test_pending_indicators_counted_in_total():
    s = suggest_level([3], total=4)
    assert s.total == 4
    assert "Nie oceniono jeszcze 3" in s.explanation


def test_invalid_level():
    with pytest.raises(ValueError):
        suggest_level([0, 3])


@pytest.mark.parametrize(
    ("values", "expected"),
    [([1], 1), ([1, 2], 1), ([1, 2, 3], 2), ([5, 1, 1, 5], 1), ([4, 4, 5, 5, 5, 1], 4)],
)
def test_lower_median(values, expected):
    assert lower_median(values) == expected
