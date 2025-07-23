import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../../utils/logger.js";

describe("Logger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("log levels", () => {
    it("should log info messages by default", () => {
      logger.info("test message");
      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] test message"),
      );
    });

    it("should not log debug messages by default", () => {
      logger.debug("debug message");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("should log debug messages when level is set to debug", () => {
      logger.setLevel("debug");
      logger.debug("debug message");
      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG] debug message"),
      );
    });

    it("should log warn messages", () => {
      logger.warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN] warning message"),
      );
    });

    it("should log error messages", () => {
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] error message"),
      );
    });
  });

  describe("data logging", () => {
    it("should log data as JSON", () => {
      const data = { foo: "bar", baz: 123 };
      logger.info("test message", data);
      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const loggedMessage = consoleInfoSpy.mock.calls[0][0];
      expect(loggedMessage).toContain("[INFO] test message");
      expect(loggedMessage).toContain(JSON.stringify(data, null, 2));
    });

    it("should log error details", () => {
      const error = new Error("test error");
      logger.error("error occurred", error);
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedMessage = consoleErrorSpy.mock.calls[0][0];
      expect(loggedMessage).toContain("[ERROR] error occurred");
      expect(loggedMessage).toContain('"message": "test error"');
    });
  });
});
