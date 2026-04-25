import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  scopes: Record<string, string[]>;
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantStorage = {
  run<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },

  get(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('No tenant context — call must be inside a tenant-scoped request');
    return ctx;
  },

  getOrNull(): TenantContext | undefined {
    return storage.getStore();
  },

  getTenantId(): string {
    return TenantStorage.get().tenantId;
  },
};
