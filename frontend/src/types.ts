export interface SnapperConfig {
  name: string;
  path: string;
  snapshotCount: number;
  lastBackup?: string;
}

export interface AppSettings {
  localPath: string;
  externalPath: string;
}

export interface Panel {
  path: string;
  configs: SnapperConfig[];
}
