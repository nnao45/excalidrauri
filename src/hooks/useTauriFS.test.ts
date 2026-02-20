import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useTauriFS } from "./useTauriFS";
import { FileItem } from "../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("useTauriFS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDir", () => {
    it("list_dir コマンドを空パスで呼び出す", async () => {
      const mockTree: FileItem[] = [
        { name: "test.excalidraw", path: "test.excalidraw", isFolder: false },
      ];
      mockInvoke.mockResolvedValue(mockTree);

      const { result } = renderHook(() => useTauriFS());
      const items = await result.current.listDir();

      expect(mockInvoke).toHaveBeenCalledWith("list_dir", { path: "" });
      expect(items).toEqual(mockTree);
    });

    it("エラーをそのまま伝播する", async () => {
      mockInvoke.mockRejectedValue(new Error("FS error"));

      const { result } = renderHook(() => useTauriFS());
      await expect(result.current.listDir()).rejects.toThrow("FS error");
    });
  });

  describe("createFolder", () => {
    it("create_folder コマンドにパスを渡して呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.createFolder("myFolder");

      expect(mockInvoke).toHaveBeenCalledWith("create_folder", {
        path: "myFolder",
      });
    });

    it("ネストパスでも正しく呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.createFolder("parent/child");

      expect(mockInvoke).toHaveBeenCalledWith("create_folder", {
        path: "parent/child",
      });
    });
  });

  describe("createCanvas", () => {
    it("create_canvas コマンドにパスを渡して呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.createCanvas("test.excalidraw");

      expect(mockInvoke).toHaveBeenCalledWith("create_canvas", {
        path: "test.excalidraw",
      });
    });

    it("フォルダ内パスでも正しく呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.createCanvas("folder/test.excalidraw");

      expect(mockInvoke).toHaveBeenCalledWith("create_canvas", {
        path: "folder/test.excalidraw",
      });
    });
  });

  describe("deleteItem", () => {
    it("delete_item コマンドにパスを渡して呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.deleteItem("foo.excalidraw");

      expect(mockInvoke).toHaveBeenCalledWith("delete_item", {
        path: "foo.excalidraw",
      });
    });

    it("フォルダパスでも正しく呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.deleteItem("myFolder");

      expect(mockInvoke).toHaveBeenCalledWith("delete_item", {
        path: "myFolder",
      });
    });
  });

  describe("renameItem", () => {
    it("rename_item コマンドに旧パスと新パスを渡して呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.renameItem("old.excalidraw", "new.excalidraw");

      expect(mockInvoke).toHaveBeenCalledWith("rename_item", {
        oldPath: "old.excalidraw",
        newPath: "new.excalidraw",
      });
    });

    it("フォルダのリネームでも正しく呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.renameItem("oldFolder", "newFolder");

      expect(mockInvoke).toHaveBeenCalledWith("rename_item", {
        oldPath: "oldFolder",
        newPath: "newFolder",
      });
    });
  });

  describe("readCanvas", () => {
    it("read_canvas コマンドにパスを渡してコンテンツを返す", async () => {
      const content = '{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}';
      mockInvoke.mockResolvedValue(content);

      const { result } = renderHook(() => useTauriFS());
      const returned = await result.current.readCanvas("test.excalidraw");

      expect(mockInvoke).toHaveBeenCalledWith("read_canvas", {
        path: "test.excalidraw",
      });
      expect(returned).toBe(content);
    });

    it("エラーをそのまま伝播する", async () => {
      mockInvoke.mockRejectedValue(new Error("File not found"));

      const { result } = renderHook(() => useTauriFS());
      await expect(
        result.current.readCanvas("missing.excalidraw")
      ).rejects.toThrow("File not found");
    });
  });

  describe("saveCanvas", () => {
    it("save_canvas コマンドにパスとコンテンツを渡して呼び出す", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const content = '{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}';

      const { result } = renderHook(() => useTauriFS());
      await result.current.saveCanvas("test.excalidraw", content);

      expect(mockInvoke).toHaveBeenCalledWith("save_canvas", {
        path: "test.excalidraw",
        content,
      });
    });

    it("空コンテンツでも呼び出せる", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTauriFS());
      await result.current.saveCanvas("test.excalidraw", "");

      expect(mockInvoke).toHaveBeenCalledWith("save_canvas", {
        path: "test.excalidraw",
        content: "",
      });
    });
  });

  describe("getBaseDirectory", () => {
    it("get_base_directory コマンドを引数なしで呼び出す", async () => {
      mockInvoke.mockResolvedValue("/home/user/.local/share/excalidrauri/canvases");

      const { result } = renderHook(() => useTauriFS());
      const dir = await result.current.getBaseDirectory();

      expect(mockInvoke).toHaveBeenCalledWith("get_base_directory");
      expect(dir).toBe("/home/user/.local/share/excalidrauri/canvases");
    });
  });

  describe("コールバックの安定性 (メモ化)", () => {
    it("再レンダリング後も listDir の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.listDir;
      rerender();
      expect(result.current.listDir).toBe(first);
    });

    it("再レンダリング後も createFolder の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.createFolder;
      rerender();
      expect(result.current.createFolder).toBe(first);
    });

    it("再レンダリング後も createCanvas の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.createCanvas;
      rerender();
      expect(result.current.createCanvas).toBe(first);
    });

    it("再レンダリング後も deleteItem の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.deleteItem;
      rerender();
      expect(result.current.deleteItem).toBe(first);
    });

    it("再レンダリング後も renameItem の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.renameItem;
      rerender();
      expect(result.current.renameItem).toBe(first);
    });

    it("再レンダリング後も readCanvas の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.readCanvas;
      rerender();
      expect(result.current.readCanvas).toBe(first);
    });

    it("再レンダリング後も saveCanvas の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.saveCanvas;
      rerender();
      expect(result.current.saveCanvas).toBe(first);
    });

    it("再レンダリング後も getBaseDirectory の参照が変わらない", () => {
      const { result, rerender } = renderHook(() => useTauriFS());
      const first = result.current.getBaseDirectory;
      rerender();
      expect(result.current.getBaseDirectory).toBe(first);
    });
  });
});
