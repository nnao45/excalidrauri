import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { FileItem } from "../types";

const mockReadCanvas = vi.fn();
const mockSaveCanvas = vi.fn();

vi.mock("../hooks/useTauriFS", () => ({
  useTauriFS: () => ({
    readCanvas: mockReadCanvas,
    saveCanvas: mockSaveCanvas,
    listDir: vi.fn(),
    createFolder: vi.fn(),
    createCanvas: vi.fn(),
    deleteItem: vi.fn(),
    renameItem: vi.fn(),
    getBaseDirectory: vi.fn(),
  }),
}));

// Excalidraw コンポーネントをモックしてシンプルなdivに置き換える
let capturedOnChange: ((...args: unknown[]) => void) | undefined;
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: vi.fn((props: { onChange?: (...args: unknown[]) => void; initialData?: unknown }) => {
    capturedOnChange = props.onChange;
    return (
      <div
        data-testid="excalidraw-mock"
        data-initial={JSON.stringify(props.initialData)}
      />
    );
  }),
}));

const sampleFile: FileItem = {
  name: "test.excalidraw",
  path: "test.excalidraw",
  isFolder: false,
};

const validCanvasContent = JSON.stringify({
  type: "excalidraw",
  version: 2,
  elements: [{ id: "elem1", type: "rectangle" }],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
});

describe("ExcalidrawCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChange = undefined;
    mockReadCanvas.mockResolvedValue(validCanvasContent);
    mockSaveCanvas.mockResolvedValue(undefined);
  });

  describe("ファイル未選択時", () => {
    it("プレースホルダーを表示する", () => {
      render(<ExcalidrawCanvas selectedFile={null} />);
      expect(screen.getByText("excalidrauri")).toBeInTheDocument();
      expect(
        screen.getByText("左サイドバーからキャンバスを選択するか、")
      ).toBeInTheDocument();
      expect(
        screen.getByText("新しいキャンバスを作成してください。")
      ).toBeInTheDocument();
    });

    it("Excalidraw コンポーネントを表示しない", () => {
      render(<ExcalidrawCanvas selectedFile={null} />);
      expect(screen.queryByTestId("excalidraw-mock")).not.toBeInTheDocument();
    });
  });

  describe("ファイル読み込み", () => {
    it("ファイル選択後にローディング状態を表示する", async () => {
      let resolveRead: (value: string) => void;
      mockReadCanvas.mockReturnValue(
        new Promise<string>((res) => { resolveRead = res; })
      );

      render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      expect(screen.getByText("読み込み中...")).toBeInTheDocument();

      await act(async () => {
        resolveRead!(validCanvasContent);
      });
    });

    it("読み込み完了後に Excalidraw を表示する", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
      });
    });

    it("ファイル名から .excalidraw を除いて表示する", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(screen.getByText("test")).toBeInTheDocument();
      });
    });

    it(".excalidraw が付いていないファイル名はそのまま表示する", async () => {
      const fileNoExt: FileItem = {
        name: "README",
        path: "README",
        isFolder: false,
      };
      render(<ExcalidrawCanvas selectedFile={fileNoExt} />);

      await waitFor(() => {
        expect(screen.getByText("README")).toBeInTheDocument();
      });
    });

    it("readCanvas を正しいパスで呼び出す", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(mockReadCanvas).toHaveBeenCalledWith("test.excalidraw");
      });
    });
  });

  describe("無効なJSONの処理", () => {
    it("JSON パースエラー時はデフォルトキャンバスデータで表示する", async () => {
      mockReadCanvas.mockResolvedValue("this is not valid json");
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
      });

      // エラーが表示されないこと（JSON パースエラーは静かに処理される）
      expect(screen.queryByText(/読み込みエラー/)).not.toBeInTheDocument();
    });
  });

  describe("読み込みエラーの処理", () => {
    it("readCanvas が失敗したときエラーメッセージを表示する", async () => {
      mockReadCanvas.mockRejectedValue(new Error("ファイルが見つかりません"));
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(screen.getByText(/読み込みエラー/)).toBeInTheDocument();
      });
    });

    it("readCanvas が失敗してもデフォルトデータで Excalidraw を表示する", async () => {
      mockReadCanvas.mockRejectedValue(new Error("FS error"));
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);

      await waitFor(() => {
        expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
      });
    });
  });

  describe("自動保存 (デバウンス)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("onChange が呼ばれると 1 秒後に saveCanvas が呼ばれる", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      // マイクロタスク（Promiseの解決）をフラッシュしてコンポーネントをロード完了させる
      await act(async () => {});

      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();

      act(() => {
        capturedOnChange?.(
          [{ id: "elem1" }],
          { viewBackgroundColor: "#ffffff" },
          {}
        );
      });

      expect(mockSaveCanvas).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockSaveCanvas).toHaveBeenCalledTimes(1);
      expect(mockSaveCanvas).toHaveBeenCalledWith(
        "test.excalidraw",
        expect.stringContaining('"type":"excalidraw"')
      );
    });

    it("連続した onChange 呼び出しは最後の 1 回だけ保存される", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      await act(async () => {});

      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();

      act(() => {
        capturedOnChange?.([{ id: "elem1" }], { viewBackgroundColor: "#fff" }, {});
        capturedOnChange?.([{ id: "elem2" }], { viewBackgroundColor: "#fff" }, {});
        capturedOnChange?.([{ id: "elem3" }], { viewBackgroundColor: "#fff" }, {});
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockSaveCanvas).toHaveBeenCalledTimes(1);
    });

    it("保存中は「保存中...」インジケーターを表示する", async () => {
      let resolveSave: () => void;
      mockSaveCanvas.mockReturnValue(
        new Promise<void>((res) => { resolveSave = res; })
      );

      render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      await act(async () => {});

      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();

      act(() => {
        capturedOnChange?.([], { viewBackgroundColor: "#fff" }, {});
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // 保存中のインジケーターが表示される
      expect(screen.getByText("保存中...")).toBeInTheDocument();

      await act(async () => {
        resolveSave!();
      });

      expect(screen.queryByText("保存中...")).not.toBeInTheDocument();
    });

    it("保存するデータには正しい appState フィールドが含まれる", async () => {
      render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      await act(async () => {});

      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();

      act(() => {
        capturedOnChange?.(
          [{ id: "elem1" }],
          {
            viewBackgroundColor: "#abcdef",
            zoom: { value: 1.5 },
            scrollX: 100,
            scrollY: 200,
            gridSize: 20,
          },
          { file1: { mimeType: "image/png" } }
        );
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await act(async () => {});

      expect(mockSaveCanvas).toHaveBeenCalled();
      const saved = JSON.parse(mockSaveCanvas.mock.calls[0][1] as string);
      expect(saved.appState.viewBackgroundColor).toBe("#abcdef");
      expect(saved.appState.zoom).toEqual({ value: 1.5 });
      expect(saved.appState.scrollX).toBe(100);
      expect(saved.appState.scrollY).toBe(200);
      expect(saved.appState.gridSize).toBe(20);
      expect(saved.files).toEqual({ file1: { mimeType: "image/png" } });
    });

    it("ファイル未選択時は onChange があっても保存しない", async () => {
      render(<ExcalidrawCanvas selectedFile={null} />);
      await act(async () => {});

      act(() => {
        capturedOnChange?.([], {}, {});
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockSaveCanvas).not.toHaveBeenCalled();
    });
  });

  describe("ファイル切り替え", () => {
    it("異なるファイルに切り替えると readCanvas が新しいパスで呼ばれる", async () => {
      const file2: FileItem = {
        name: "second.excalidraw",
        path: "second.excalidraw",
        isFolder: false,
      };

      const { rerender } = render(<ExcalidrawCanvas selectedFile={sampleFile} />);
      await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());

      rerender(<ExcalidrawCanvas selectedFile={file2} />);
      await waitFor(() => {
        expect(mockReadCanvas).toHaveBeenCalledWith("second.excalidraw");
      });
    });
  });
});
