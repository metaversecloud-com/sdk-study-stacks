// Mock of @rtsdk/topia used by Jest. Lightweight stubs for the SDK surface we touch.

export const fireToast = jest.fn().mockResolvedValue({ success: true });
export const triggerParticle = jest.fn().mockResolvedValue({ success: true });

export class Topia {
  constructor(_opts: any) {}
}

export class AssetFactory {
  constructor(_topia: any) {}
}

export class DroppedAssetFactory {
  constructor(_topia: any) {}
}

export class UserFactory {
  constructor(_topia: any) {}
}

export class EcosystemFactory {
  constructor(_topia: any) {}
}

export class VisitorFactory {
  constructor(_topia: any) {}
}

export class WorldFactory {
  constructor(_topia: any) {}
  create(slug: string, opts: any) {
    (__mock as any).lastWorldCreateArgs = { slug, opts };
    return { fireToast, triggerParticle };
  }
}

export class WorldActivityFactory {
  constructor(_topia: any) {}
}

// Types — exported as `any` so consumers that `import type { … }` still compile under ts-jest.
export type DroppedAssetInterface = any;
export type VisitorInterface = any;
export type InventoryItemInterface = any;
export type WorldInterface = any;

export const __mock = {
  fireToast,
  triggerParticle,
  lastWorldCreateArgs: null as any,
  reset() {
    fireToast.mockClear();
    triggerParticle.mockClear();
    this.lastWorldCreateArgs = null;
  },
};
