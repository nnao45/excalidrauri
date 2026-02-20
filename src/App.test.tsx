import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { FileItem } from "./types";

const mockListDir = vi.fn();

vi.mock("./hooks/useTauriFS", () => ({
  useTauriFS: () => ({
    listDir: mockListDir,
    createCanvas: vi.fn(),
    createFolder: vi.fn(),
    deleteItem: vi.fn(),
    renameItem: vi.fn(),
    readCanvas: vi.fn().mockResolvedValue("{}"),
    saveCanvas: vi.fn().mockResolvedValue(undefined),
    getBaseDirectory: vi.fn().mockResolvedValue(""),
  }),
}));

vi.mock("./components/Sidebar", () => ({
  Sidebar: vi.fn(
    ({
      fileTree,
      selectedFile,
      onSelectFile,
      onRefresh,
    }: {
      fileTree: FileItem[];
      selectedFile: FileItem | null;
      onSelectFile: (item: FileItem) => void;
      onRefresh: () => void;
    }) => (
      <div data-testid="sidebar">
        <span data-testid="tree-count">{fileTree.length}</span>
        <span data-testid="selected-path">{selectedFile?.path ?? "none"}</span>
        <button
          data-testid="select-file-btn"
          onClick={() =>
            onSelectFile({
              name: "test.excalidraw",
              path: "test.excalidraw",
              isFolder: false,
            })
          }
        >
          ファイル選択
        </button>
        <button
          data-testid="select-folder-btn"
          onClick={() =>
            onSelectFile({
              name: "myFolder",
              path: "myFolder",
              isFolder: true,
            })
          }
        >
          フォルダ選択
        </button>
        <button data-testid="refresh-btn" onClick={onRefresh}>
          更新
        </button>
      </div>
    )
  ),
}));

vi.mock("./components/ExcalidrawCanvas", () => ({
  ExcalidrawCanvas: vi.fn(({ selectedFile }: { selectedFile: FileItem | null }) => (
    <div data-testid="canvas">{selectedFile?.path ?? "no-file"}</div>
  )),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDir.mockResolvedValue([]);
  });

  describe("初期ロード", () => {
    it("ローディング中は「読み込み中...」を表示する", async () => {
      let resolveList: (value: FileItem[]) => void;
      mockListDir.mockReturnValue(
        new Promise<FileItem[]>((res) => { resolveList = res; })
      );

      render(<App />);
      expect(screen.getByText("読み込み中...")).toBeInTheDocument();

      await act(async () => {
        resolveList!([]);
      });
    });

    it("ロード完了後はローディング表示が消える", async () => {
      mockListDir.mockResolvedValue([]);
      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
      });
    });

    it("ロード完了後は Sidebar と Canvas を表示する", async () => {
      mockListDir.mockResolvedValue([]);
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("sidebar")).toBeInTheDocument();
        expect(screen.getByTestId("canvas")).toBeInTheDocument();
      });
    });

    it("ヘッダーにアプリタイトルを表示する", async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("excalidrauri")).toBeInTheDocument();
      });
    });
  });

  describe("エラー処理", () => {
    it("listDir が失敗したときはエラーメッセージを表示する", async () => {
      mockListDir.mockRejectedValue(new Error("permission denied"));
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/エラー: Error: permission denied/)).toBeInTheDocument();
      });
    });

    it("エラー後はローディング表示が消える", async () => {
      mockListDir.mockRejectedValue(new Error("fs error"));
      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
      });
    });
  });

  describe("ファイルツリーの渡し", () => {
    it("listDir の結果をそのまま Sidebar に渡す", async () => {
      const mockTree: FileItem[] = [
        { name: "a.excalidraw", path: "a.excalidraw", isFolder: false },
        { name: "b.excalidraw", path: "b.excalidraw", isFolder: false },
        { name: "folderC", path: "folderC", isFolder: true, children: [] },
      ];
      mockListDir.mockResolvedValue(mockTree);
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("tree-count").textContent).toBe("3");
      });
    });
  });

  describe("ファイル選択", () => {
    it("ファイルをクリックすると selectedFile に設定される", async () => {
      mockListDir.mockResolvedValue([]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      await userEvent.click(screen.getByTestId("select-file-btn"));

      expect(screen.getByTestId("selected-path").textContent).toBe(
        "test.excalidraw"
      );
      expect(screen.getByTestId("canvas").textContent).toBe("test.excalidraw");
    });

    it("フォルダをクリックしても selectedFile は変わらない", async () => {
      mockListDir.mockResolvedValue([]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      // まずファイルを選択する
      await userEvent.click(screen.getByTestId("select-file-btn"));
      expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");

      // フォルダをクリックしても変わらない
      await userEvent.click(screen.getByTestId("select-folder-btn"));
      expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");
    });

    it("初期状態では selectedFile は null", async () => {
      mockListDir.mockResolvedValue([]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      expect(screen.getByTestId("selected-path").textContent).toBe("none");
    });
  });

  describe("ファイルツリーの更新と selectedFile の整合", () => {
    it("更新後もツリーに存在するファイルは selectedFile のままになる", async () => {
      const fileInTree: FileItem = {
        name: "test.excalidraw",
        path: "test.excalidraw",
        isFolder: false,
      };
      mockListDir.mockResolvedValue([fileInTree]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      // ファイルを選択
      await userEvent.click(screen.getByTestId("select-file-btn"));
      expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");

      // 更新後もファイルが存在するので selectedFile は維持される
      await act(async () => {
        await userEvent.click(screen.getByTestId("refresh-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");
      });
    });

    it("更新後にツリーから消えたファイルは selectedFile が null になる", async () => {
      // 最初は test.excalidraw がある
      const fileInTree: FileItem = {
        name: "test.excalidraw",
        path: "test.excalidraw",
        isFolder: false,
      };
      mockListDir.mockResolvedValue([fileInTree]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      // ファイルを選択
      await userEvent.click(screen.getByTestId("select-file-btn"));
      expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");

      // 次の更新では空のツリーが返ってくる（ファイルが削除された）
      mockListDir.mockResolvedValue([]);

      await act(async () => {
        await userEvent.click(screen.getByTestId("refresh-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-path").textContent).toBe("none");
      });
    });

    it("selectedFile が null のときは更新後も null のまま", async () => {
      mockListDir.mockResolvedValue([
        {
          name: "a.excalidraw",
          path: "a.excalidraw",
          isFolder: false,
        },
      ]);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      // ファイルを選択しない
      expect(screen.getByTestId("selected-path").textContent).toBe("none");

      await act(async () => {
        await userEvent.click(screen.getByTestId("refresh-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-path").textContent).toBe("none");
      });
    });

    it("更新後もフォルダ内のファイルが存在するなら selectedFile を維持する", async () => {
      // テスト用のSidebarモックが "test.excalidraw" を選択ファイルとして渡すが、
      // 更新後のツリーに "test.excalidraw" が含まれていれば selectedFile は維持される。
      // findFileByPath のネスト検索は src/utils/fileTree.test.ts で詳細に検証済み。
      const fileInTree: FileItem = {
        name: "test.excalidraw",
        path: "test.excalidraw",
        isFolder: false,
      };
      // フォルダ内にも別ファイルを持たせる（ツリーが複雑でも動作することを確認）
      const tree: FileItem[] = [
        fileInTree,
        {
          name: "folder",
          path: "folder",
          isFolder: true,
          children: [
            {
              name: "other.excalidraw",
              path: "folder/other.excalidraw",
              isFolder: false,
            },
          ],
        },
      ];
      mockListDir.mockResolvedValue(tree);
      render(<App />);

      await waitFor(() => expect(screen.getByTestId("sidebar")).toBeInTheDocument());

      // "test.excalidraw" を選択
      await userEvent.click(screen.getByTestId("select-file-btn"));
      expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");

      // 更新後も "test.excalidraw" がツリーに存在するので selectedFile は維持される
      await act(async () => {
        await userEvent.click(screen.getByTestId("refresh-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("selected-path").textContent).toBe("test.excalidraw");
      });
    });
  });
});
