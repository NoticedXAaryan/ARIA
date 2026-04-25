from engine.interrupt_gate import should_deliver


def test_interrupt_gate_blocks_deep_focus() -> None:
    assert should_deliver("deep_focus", []) is False


def test_interrupt_gate_allows_normal_no_meeting() -> None:
    assert should_deliver("normal", []) is True
