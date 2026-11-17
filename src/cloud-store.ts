export type CloudSnapshot<T> = { revision: number; data: T };
export type CloudState<T> = {
  data: T;
  revision: number;
  ready: boolean;
  busy: boolean;
  blocked: boolean;
  error: string;
};
export interface CloudTransport<T> {
  load(): Promise<CloudSnapshot<T>>;
  save(snapshot: CloudSnapshot<T>): Promise<CloudSnapshot<T>>;
}
export class CloudConflict<T> extends Error {
  snapshot: CloudSnapshot<T>;
  constructor(snapshot: CloudSnapshot<T>) {
    super("其他裝置已修改資料，已重新同步；請確認內容後再操作。");
    this.snapshot = snapshot;
  }
}
export function httpTransport<T>(
  kind: "tasks" | "expenses",
  validate: (raw: string) => T,
  fetcher: typeof fetch = fetch,
): CloudTransport<T> {
  async function request(init?: RequestInit): Promise<CloudSnapshot<T>> {
    const response = await fetcher(`/api/records/${kind}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      ...init,
    });
    if (response.status === 401)
      throw new Error("請先連線並使用同一個 ChatGPT 帳號登入。");
    const body = await response.json();
    if (response.status === 409) {
      if (!Number.isSafeInteger(body.revision) || body.revision < 0)
        throw new Error("同步資料格式錯誤。");
      throw new CloudConflict({
        revision: body.revision,
        data: validate(JSON.stringify(body.data)),
      });
    }
    if (!response.ok)
      throw new Error(body.error || "遠端資料庫暫時無法使用，尚未儲存。");
    if (!Number.isSafeInteger(body.revision) || body.revision < 0)
      throw new Error("同步資料格式錯誤。");
    return {
      revision: body.revision,
      data: validate(JSON.stringify(body.data)),
    };
  }
  return {
    load: () => request(),
    save: (snapshot) =>
      request({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }),
  };
}

// This controller has no React or browser-storage dependency, so sync behavior can be unit tested.
export class CloudStore<T> {
  private state: CloudState<T>;
  private listeners = new Set<() => void>();
  private reading = false;
  private generation = 0;
  private transport: CloudTransport<T>;
  constructor(transport: CloudTransport<T>, empty: T) {
    this.transport = transport;
    this.state = {
      data: empty,
      revision: 0,
      ready: false,
      busy: false,
      blocked: true,
      error: "",
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(patch: Partial<CloudState<T>>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  async refresh() {
    if (this.reading || this.state.busy) return;
    this.reading = true;
    const generation = this.generation;
    try {
      const snapshot = await this.transport.load();
      if (
        generation === this.generation &&
        snapshot.revision >= this.state.revision
      )
        this.patch({ ...snapshot, ready: true, blocked: false, error: "" });
    } catch {
      if (generation === this.generation)
        this.patch({
          ready: true,
          blocked: true,
          error:
            "無法同步遠端資料。請確認網路與登入狀態後重試；未儲存任何新變更。",
        });
    } finally {
      this.reading = false;
    }
  }
  async save(
    data: T,
    expectedRevision = this.state.revision,
  ): Promise<boolean> {
    if (!this.state.ready || this.state.blocked || this.state.busy)
      return false;
    ++this.generation;
    this.patch({ busy: true, error: "" });
    try {
      const snapshot = await this.transport.save({
        revision: expectedRevision,
        data,
      });
      this.patch({ ...snapshot, blocked: false });
      return true;
    } catch (cause) {
      if (cause instanceof CloudConflict)
        this.patch({ ...cause.snapshot, blocked: false, error: cause.message });
      else
        this.patch({
          blocked: true,
          error: "無法確認遠端儲存結果。請重新同步後確認紀錄，再重試。",
        });
      return false;
    } finally {
      this.patch({ busy: false });
    }
  }
}
