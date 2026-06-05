// Mock prisma (must be defined before jest.mock factory uses it)
const mockPrisma = {
  InventoryItem: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  TenantCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}

// Mocks (declare before importing service)
jest.mock('../src/audit', () => ({
  audit: jest.fn(async () => {}),
}))

jest.mock('../src/utils/revalidate', () => ({
  triggerRevalidate: jest.fn(async () => true),
}))

jest.mock('../src/prisma', () => ({ prisma: mockPrisma }))

describe('CategoryService.assignItemCategory', () => {
  const tenantId = 't1'
  const itemId = 'i1'

  let svc: typeof import('../src/services/CategoryService').categoryService

  beforeAll(() => {
    jest.resetModules()
    jest.isolateModules(() => {
      svc = require('../src/services/CategoryService').categoryService
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws 400 when neither tenantCategoryId nor categorySlug provided', async () => {
    await expect(svc.assignItemCategory(tenantId, itemId, {} as any)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 404 when item not found', async () => {
    mockPrisma.InventoryItem.findFirst.mockResolvedValueOnce(null)
    await expect(svc.assignItemCategory(tenantId, itemId, { tenantCategoryId: 'c1' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 404 when category not found', async () => {
    mockPrisma.InventoryItem.findFirst.mockResolvedValueOnce({ id: itemId, tenantId })
    mockPrisma.TenantCategory.findFirst.mockResolvedValueOnce(null)
    await expect(svc.assignItemCategory(tenantId, itemId, { tenantCategoryId: 'c1' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('updates item categoryPath to leaf slug and returns updated item', async () => {
    mockPrisma.InventoryItem.findFirst.mockResolvedValueOnce({ id: itemId, tenantId })
    mockPrisma.TenantCategory.findFirst.mockResolvedValueOnce({ id: 'c1', slug: 'leaf-slug', isActive: true, tenantId })
    const updated = { id: itemId, categoryPath: ['leaf-slug'] }
    mockPrisma.InventoryItem.update.mockResolvedValueOnce(updated)

    const result = await svc.assignItemCategory(tenantId, itemId, { tenantCategoryId: 'c1' })
    expect(result).toEqual(updated)
    expect(mockPrisma.InventoryItem.update).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { categoryPath: ['leaf-slug'] as any },
    })
  })
})

describe('CategoryService.createTenantCategory', () => {
  let svc: typeof import('../src/services/CategoryService').categoryService
  beforeAll(() => {
    jest.resetModules()
    jest.isolateModules(() => {
      svc = require('../src/services/CategoryService').categoryService
    })
  })
  beforeEach(() => jest.clearAllMocks())

  it('creates category with defaults', async () => {
    const created = { id: 'c1', name: 'Name', slug: 'slug', tenantId: 't1', sortOrder: 0 }
    mockPrisma.TenantCategory.create.mockResolvedValueOnce(created)
    const res = await svc.createTenantCategory('t1', { name: 'Name', slug: 'slug' })
    expect(res).toEqual(created)
    expect(mockPrisma.TenantCategory.create).toHaveBeenCalled()
  })
})

describe('CategoryService.alignCategory', () => {
  let svc: typeof import('../src/services/CategoryService').categoryService
  beforeAll(() => {
    jest.resetModules()
    jest.isolateModules(() => {
      svc = require('../src/services/CategoryService').categoryService
    })
  })
  beforeEach(() => jest.clearAllMocks())

  it('updates googleCategoryId', async () => {
    const updated = { id: 'c1', googleCategoryId: '123' }
    mockPrisma.TenantCategory.update.mockResolvedValueOnce(updated)
    const res = await svc.alignCategory('t1', 'c1', '123')
    expect(res).toEqual(updated)
    expect(mockPrisma.TenantCategory.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { googleCategoryId: '123' } })
  })
})
