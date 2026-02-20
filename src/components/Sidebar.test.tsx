import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { FileItem } from "../types";

const mockCreateCanvas = vi.fn();
const mockCreateFolder = vi.fn();
const mockDeleteItem = vi.fn();
const mockRenameItem = vi.fn();

vi.mock("../hooks/useTauriFS", () => ({
  useTauriFS: () => ({
    createCanvas: mockCreateCanvas,
    createFolder: mockCreateFolder,
    deleteItem: mockDeleteItem,
    renameItem: mockRenameItem,
    listDir: vi.fn().mockResolvedValue([]),
    readCanvas: vi.fn().mockResolvedValue(""),
    saveCanvas: vi.fn().mockResolvedValue(undefined),
    getBaseDirectory: vi.fn().mockResolvedValue(""),
  }),
}));

const sampleFile: FileItem = {
  name: "test.excalidraw",
  path: "test.excalidraw",
  isFolder: false,
};

const sampleFolder: FileItem = {
  name: "myFolder",
  path: "myFolder",
  isFolder: true,
  children: [sampleFile],
};

const defaultProps = {
  fileTree: [],
  selectedFile: null,
  onSelectFile: vi.fn(),
  onRefresh: vi.fn(),
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockCreateCanvas.mockResolvedValue(undefined);
    mockCreateFolder.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    mockRenameItem.mockResolvedValue(undefined);
  });

  describe("空のファイルツリー", () => {
    it("キャンバスがないときは案内メッセージを表示する", () => {
      render(<Sidebar {...defaultProps} fileTree={[]} />);
      expect(screen.getByText("キャンバスがありません")).toBeInTheDocument();
      expect(screen.getByText("右クリックまたは上部ボタンで作成")).toBeInTheDocument();
    });

    it("ヘッダーにタイトルを表示する", () => {
      render(<Sidebar {...defaultProps} fileTree={[]} />);
      expect(screen.getByText("キャンバス")).toBeInTheDocument();
    });
  });

  describe("ファイルツリーの表示", () => {
    it(".excalidraw 拡張子を除いてファイル名を表示する", () => {
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);
      expect(screen.getByText("test")).toBeInTheDocument();
    });

    it(".excalidraw が付いていないファイル名はそのまま表示する", () => {
      const f: FileItem = { name: "README", path: "README", isFolder: false };
      render(<Sidebar {...defaultProps} fileTree={[f]} />);
      expect(screen.getByText("README")).toBeInTheDocument();
    });

    it("フォルダ名をそのまま表示する", () => {
      render(
        <Sidebar {...defaultProps} fileTree={[{ ...sampleFolder, children: [] }]} />
      );
      expect(screen.getByText("myFolder")).toBeInTheDocument();
    });

    it("折りたたまれたフォルダには ▸ アイコンを表示する", () => {
      render(
        <Sidebar {...defaultProps} fileTree={[{ ...sampleFolder, children: [] }]} />
      );
      expect(screen.getByText("▸")).toBeInTheDocument();
    });

    it("ファイルには ◻ アイコンを表示する", () => {
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);
      expect(screen.getByText("◻")).toBeInTheDocument();
    });

    it("選択されたファイルに selected クラスを付与する", () => {
      const { container } = render(
        <Sidebar {...defaultProps} fileTree={[sampleFile]} selectedFile={sampleFile} />
      );
      const nodes = container.querySelectorAll(".tree-node.selected");
      expect(nodes.length).toBe(1);
    });

    it("選択されていないファイルには selected クラスを付与しない", () => {
      const { container } = render(
        <Sidebar {...defaultProps} fileTree={[sampleFile]} selectedFile={null} />
      );
      const nodes = container.querySelectorAll(".tree-node.selected");
      expect(nodes.length).toBe(0);
    });
  });

  describe("フォルダの展開/折りたたみ", () => {
    it("フォルダをクリックすると展開される", async () => {
      const folderWithChild = {
        ...sampleFolder,
        children: [sampleFile],
      };
      render(<Sidebar {...defaultProps} fileTree={[folderWithChild]} />);

      const folderNode = screen.getByText("myFolder").closest(".tree-node")!;
      await userEvent.click(folderNode);

      expect(screen.getByText("▾")).toBeInTheDocument();
      expect(screen.getByText("test")).toBeInTheDocument();
    });

    it("展開済みフォルダを再クリックすると折りたたまれる", async () => {
      const folderWithChild = {
        ...sampleFolder,
        children: [sampleFile],
      };
      render(<Sidebar {...defaultProps} fileTree={[folderWithChild]} />);

      const folderNode = screen.getByText("myFolder").closest(".tree-node")!;
      await userEvent.click(folderNode);
      await userEvent.click(folderNode);

      expect(screen.getByText("▸")).toBeInTheDocument();
      expect(screen.queryByText("test")).not.toBeInTheDocument();
    });

    it("空のフォルダを展開すると「空のフォルダ」と表示される", async () => {
      const emptyFolder = { ...sampleFolder, children: [] };
      render(<Sidebar {...defaultProps} fileTree={[emptyFolder]} />);

      const folderNode = screen.getByText("myFolder").closest(".tree-node")!;
      await userEvent.click(folderNode);

      expect(screen.getByText("空のフォルダ")).toBeInTheDocument();
    });
  });

  describe("ファイル選択", () => {
    it("ファイルをクリックすると onSelectFile が呼ばれる", async () => {
      const onSelectFile = vi.fn();
      render(
        <Sidebar {...defaultProps} fileTree={[sampleFile]} onSelectFile={onSelectFile} />
      );

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      await userEvent.click(fileNode);

      expect(onSelectFile).toHaveBeenCalledWith(sampleFile);
    });

    it("フォルダをクリックしても onSelectFile は呼ばれない", async () => {
      const onSelectFile = vi.fn();
      const emptyFolder = { ...sampleFolder, children: [] };
      render(
        <Sidebar {...defaultProps} fileTree={[emptyFolder]} onSelectFile={onSelectFile} />
      );

      const folderNode = screen.getByText("myFolder").closest(".tree-node")!;
      await userEvent.click(folderNode);

      expect(onSelectFile).not.toHaveBeenCalled();
    });
  });

  describe("ヘッダーボタン", () => {
    it("更新ボタンをクリックすると onRefresh が呼ばれる", async () => {
      const onRefresh = vi.fn();
      render(<Sidebar {...defaultProps} onRefresh={onRefresh} />);

      await userEvent.click(screen.getByTitle("更新"));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("新規キャンバスボタンをクリックするとプロンプトが表示される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));
      expect(window.prompt).toHaveBeenCalledWith("キャンバス名を入力してください:");
    });

    it("新規フォルダボタンをクリックするとプロンプトが表示される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規フォルダ"));
      expect(window.prompt).toHaveBeenCalledWith("フォルダ名を入力してください:");
    });
  });

  describe("新規キャンバス作成", () => {
    it("名前を入力するとキャンバスが作成される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("myCanvas");
      const onRefresh = vi.fn();
      render(<Sidebar {...defaultProps} onRefresh={onRefresh} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));

      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith("myCanvas.excalidraw");
      });
      expect(onRefresh).toHaveBeenCalled();
    });

    it("名前に .excalidraw が既についている場合は追加しない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("myCanvas.excalidraw");
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));

      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith("myCanvas.excalidraw");
      });
    });

    it("名前に無効文字が含まれる場合はハイフンに置換する", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("my/canvas");
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));

      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith("my-canvas.excalidraw");
      });
    });

    it("空文字や null が返った場合はキャンバスを作成しない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));

      expect(mockCreateCanvas).not.toHaveBeenCalled();
    });

    it("空白のみの名前ではキャンバスを作成しない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("   ");
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規キャンバス"));

      expect(mockCreateCanvas).not.toHaveBeenCalled();
    });
  });

  describe("新規フォルダ作成", () => {
    it("名前を入力するとフォルダが作成される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("newFolder");
      const onRefresh = vi.fn();
      render(<Sidebar {...defaultProps} onRefresh={onRefresh} />);

      await userEvent.click(screen.getByTitle("新規フォルダ"));

      await waitFor(() => {
        expect(mockCreateFolder).toHaveBeenCalledWith("newFolder");
      });
      expect(onRefresh).toHaveBeenCalled();
    });

    it("無効文字が含まれる場合はハイフンに置換する", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("my:folder");
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規フォルダ"));

      await waitFor(() => {
        expect(mockCreateFolder).toHaveBeenCalledWith("my-folder");
      });
    });

    it("null が返った場合はフォルダを作成しない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} />);

      await userEvent.click(screen.getByTitle("新規フォルダ"));

      expect(mockCreateFolder).not.toHaveBeenCalled();
    });
  });

  describe("コンテキストメニュー", () => {
    it("ファイルを右クリックするとコンテキストメニューが表示される", async () => {
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);

      expect(screen.getByText("＋ 新規キャンバス")).toBeInTheDocument();
      expect(screen.getByText("＋ 新規フォルダ")).toBeInTheDocument();
      expect(screen.getByText("名前変更")).toBeInTheDocument();
      expect(screen.getByText("削除")).toBeInTheDocument();
    });

    it("ルート領域を右クリックするとコンテキストメニューが表示される", async () => {
      render(<Sidebar {...defaultProps} fileTree={[]} />);

      const sidebarTree = document.querySelector(".sidebar-tree")!;
      fireEvent.contextMenu(sidebarTree);

      expect(screen.getByText("＋ 新規キャンバス")).toBeInTheDocument();
      expect(screen.getByText("＋ 新規フォルダ")).toBeInTheDocument();
      expect(screen.queryByText("名前変更")).not.toBeInTheDocument();
      expect(screen.queryByText("削除")).not.toBeInTheDocument();
    });

    it("外側をクリックするとコンテキストメニューが閉じる", async () => {
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      expect(screen.getByText("名前変更")).toBeInTheDocument();

      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText("名前変更")).not.toBeInTheDocument();
      });
    });

    it("削除ボタンをクリックすると確認ダイアログが表示される", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("削除"));

      expect(window.confirm).toHaveBeenCalledWith('キャンバス "test" を削除しますか？');
    });

    it("削除を確認するとアイテムが削除される", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const onRefresh = vi.fn();
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} onRefresh={onRefresh} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("削除"));

      await waitFor(() => {
        expect(mockDeleteItem).toHaveBeenCalledWith("test.excalidraw");
      });
      expect(onRefresh).toHaveBeenCalled();
    });

    it("削除をキャンセルするとアイテムは削除されない", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("削除"));

      expect(mockDeleteItem).not.toHaveBeenCalled();
    });

    it("フォルダの削除確認ダイアログはフォルダ名を含む", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const emptyFolder = { ...sampleFolder, children: [] };
      render(<Sidebar {...defaultProps} fileTree={[emptyFolder]} />);

      const folderNode = screen.getByText("myFolder").closest(".tree-node")!;
      fireEvent.contextMenu(folderNode);
      await userEvent.click(screen.getByText("削除"));

      expect(window.confirm).toHaveBeenCalledWith('フォルダ "myFolder" を削除しますか？');
    });

    it("名前変更ボタンをクリックするとプロンプトが表示される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("名前変更"));

      expect(window.prompt).toHaveBeenCalledWith(
        "新しい名前を入力してください:",
        "test"
      );
    });

    it("名前変更で新しい名前を入力するとファイルがリネームされる", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("renamed");
      const onRefresh = vi.fn();
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} onRefresh={onRefresh} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("名前変更"));

      await waitFor(() => {
        expect(mockRenameItem).toHaveBeenCalledWith(
          "test.excalidraw",
          "renamed.excalidraw"
        );
      });
      expect(onRefresh).toHaveBeenCalled();
    });

    it("名前変更で同じ名前を入力した場合はリネームしない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("test");
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("名前変更"));

      expect(mockRenameItem).not.toHaveBeenCalled();
    });

    it("名前変更で null が返った場合はリネームしない", async () => {
      vi.spyOn(window, "prompt").mockReturnValue(null);
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("名前変更"));

      expect(mockRenameItem).not.toHaveBeenCalled();
    });
  });

  describe("ネストしたパスの構築", () => {
    it("フォルダ内でキャンバスを作成するとパスが正しく構築される", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("child");
      const expandedFolder: FileItem = {
        name: "parent",
        path: "parent",
        isFolder: true,
        children: [],
      };
      render(<Sidebar {...defaultProps} fileTree={[expandedFolder]} />);

      // フォルダを展開してからコンテキストメニューを開く
      const folderNode = screen.getByText("parent").closest(".tree-node")!;
      await userEvent.click(folderNode);
      fireEvent.contextMenu(folderNode);
      await userEvent.click(screen.getByText("＋ 新規キャンバス"));

      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith("parent/child.excalidraw");
      });
    });

    it("ファイルをルートで右クリックしたときにルートパスを使う", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("rootCanvas");
      render(<Sidebar {...defaultProps} fileTree={[sampleFile]} />);

      const fileNode = screen.getByText("test").closest(".tree-node")!;
      fireEvent.contextMenu(fileNode);
      await userEvent.click(screen.getByText("＋ 新規キャンバス"));

      await waitFor(() => {
        // ルートファイルなので parentPath は ""
        expect(mockCreateCanvas).toHaveBeenCalledWith("rootCanvas.excalidraw");
      });
    });
  });
});
