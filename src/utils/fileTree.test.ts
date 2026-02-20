import { describe, it, expect } from "vitest";
import { findFileByPath } from "./fileTree";
import { FileItem } from "../types";

const file = (name: string, path: string): FileItem => ({
  name,
  path,
  isFolder: false,
});

const folder = (
  name: string,
  path: string,
  children: FileItem[] = []
): FileItem => ({
  name,
  path,
  isFolder: true,
  children,
});

describe("findFileByPath", () => {
  it("空のツリーでは null を返す", () => {
    expect(findFileByPath([], "foo.excalidraw")).toBeNull();
  });

  it("ルートレベルのファイルを見つける", () => {
    const item = file("foo.excalidraw", "foo.excalidraw");
    const tree = [item];
    expect(findFileByPath(tree, "foo.excalidraw")).toBe(item);
  });

  it("ルートレベルのフォルダを見つける", () => {
    const f = folder("myFolder", "myFolder");
    const tree = [f];
    expect(findFileByPath(tree, "myFolder")).toBe(f);
  });

  it("ネストしたフォルダ内のファイルを見つける", () => {
    const child = file("child.excalidraw", "folder/child.excalidraw");
    const tree = [folder("folder", "folder", [child])];
    expect(findFileByPath(tree, "folder/child.excalidraw")).toBe(child);
  });

  it("複数ネストされたファイルを見つける", () => {
    const deep = file("deep.excalidraw", "a/b/c/deep.excalidraw");
    const tree = [
      folder("a", "a", [
        folder("b", "a/b", [folder("c", "a/b/c", [deep])]),
      ]),
    ];
    expect(findFileByPath(tree, "a/b/c/deep.excalidraw")).toBe(deep);
  });

  it("存在しないパスでは null を返す", () => {
    const tree = [file("foo.excalidraw", "foo.excalidraw")];
    expect(findFileByPath(tree, "bar.excalidraw")).toBeNull();
  });

  it("空のchildrenを持つフォルダに対してnullを返す", () => {
    const tree = [folder("emptyFolder", "emptyFolder", [])];
    expect(findFileByPath(tree, "emptyFolder/missing.excalidraw")).toBeNull();
  });

  it("children が undefined のフォルダに対して null を返す", () => {
    const tree: FileItem[] = [
      { name: "folder", path: "folder", isFolder: true },
    ];
    expect(findFileByPath(tree, "folder/foo.excalidraw")).toBeNull();
  });

  it("複数のルートアイテムから正しいものを返す", () => {
    const a = file("a.excalidraw", "a.excalidraw");
    const b = file("b.excalidraw", "b.excalidraw");
    const c = file("c.excalidraw", "c.excalidraw");
    const tree = [a, b, c];
    expect(findFileByPath(tree, "b.excalidraw")).toBe(b);
  });

  it("同一パスのアイテムがフォルダ内にある場合も正しく見つける", () => {
    const f1 = file("note.excalidraw", "folder1/note.excalidraw");
    const f2 = file("note.excalidraw", "folder2/note.excalidraw");
    const tree = [
      folder("folder1", "folder1", [f1]),
      folder("folder2", "folder2", [f2]),
    ];
    expect(findFileByPath(tree, "folder2/note.excalidraw")).toBe(f2);
  });

  it("空文字パスでは null を返す（マッチするアイテムがない場合）", () => {
    const tree = [file("foo.excalidraw", "foo.excalidraw")];
    expect(findFileByPath(tree, "")).toBeNull();
  });

  it("フォルダ自体のパスを指定したときフォルダを返す", () => {
    const f = folder("myFolder", "myFolder", [
      file("child.excalidraw", "myFolder/child.excalidraw"),
    ]);
    const tree = [f];
    expect(findFileByPath(tree, "myFolder")).toBe(f);
  });
});
