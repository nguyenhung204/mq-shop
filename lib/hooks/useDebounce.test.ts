import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SEARCH_DEBOUNCE_MS } from "./useDebounce";

describe("useDebounce constants & logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("default debounce delay is 400ms", () => {
    expect(DEFAULT_SEARCH_DEBOUNCE_MS).toBe(400);
  });

  it("debounces rapid consecutive calls to only the final call", () => {
    const spy = vi.fn();
    let timer: NodeJS.Timeout | null = null;

    const debounced = (text: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        spy(text);
      }, DEFAULT_SEARCH_DEBOUNCE_MS);
    };

    debounced("i");
    vi.advanceTimersByTime(100);
    debounced("ip");
    vi.advanceTimersByTime(100);
    debounced("iph");
    vi.advanceTimersByTime(100);
    debounced("iphone");

    expect(spy).not.toHaveBeenCalled();

    // Advance 399ms — still not called
    vi.advanceTimersByTime(399);
    expect(spy).not.toHaveBeenCalled();

    // Advance 1ms (total 400ms after last call)
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("iphone");
  });

  it("supports flush to execute immediately and cancel timer", () => {
    const spy = vi.fn();
    let timer: NodeJS.Timeout | null = null;

    const debounced = (text: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        spy(text);
      }, DEFAULT_SEARCH_DEBOUNCE_MS);
    };

    const flush = (text: string) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      spy(text);
    };

    debounced("macbook");
    vi.advanceTimersByTime(150);
    expect(spy).not.toHaveBeenCalled();

    // User presses Enter
    flush("macbook");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("macbook");

    // Advance remaining time — timer should not fire again
    vi.advanceTimersByTime(500);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("supports cancel to abort pending debounce without executing", () => {
    const spy = vi.fn();
    let timer: NodeJS.Timeout | null = null;

    const debounced = (text: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        spy(text);
      }, DEFAULT_SEARCH_DEBOUNCE_MS);
    };

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    debounced("shoes");
    vi.advanceTimersByTime(200);
    cancel();

    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
  });
});

