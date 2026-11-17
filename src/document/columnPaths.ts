/** Keep sibling fields together, including fields discovered in later records. */
export function orderFieldPaths(paths: string[][]): string[][] {
  type Branch = { leaf?: string[]; children: Map<string, Branch> };
  const root: Branch = { children: new Map() };
  for (const path of paths) {
    let branch = root;
    for (const name of path) {
      let child = branch.children.get(name);
      if (!child) {
        child = { children: new Map() };
        branch.children.set(name, child);
      }
      branch = child;
    }
    branch.leaf = path;
  }
  const result: string[][] = [];
  const visit = (branch: Branch) => {
    if (branch.leaf) result.push(branch.leaf);
    for (const child of branch.children.values()) visit(child);
  };
  visit(root);
  return result;
}
