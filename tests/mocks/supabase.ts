import { mock } from "bun:test";

// Mock Supabase client
export const createMockSupabaseClient = () => {
  const mockClient = {
    from: mock((table: string) => {
      const chainableObj = {
        select: mock(() => chainableObj),
        insert: mock(() => chainableObj),
        update: mock(() => chainableObj),
        upsert: mock(() => chainableObj),
        delete: mock(() => chainableObj),
        eq: mock(() => chainableObj),
        neq: mock(() => chainableObj),
        gt: mock(() => chainableObj),
        gte: mock(() => chainableObj),
        lt: mock(() => chainableObj),
        lte: mock(() => chainableObj),
        like: mock(() => chainableObj),
        ilike: mock(() => chainableObj),
        is: mock(() => chainableObj),
        in: mock(() => chainableObj),
        contains: mock(() => chainableObj),
        containedBy: mock(() => chainableObj),
        not: mock(() => chainableObj),
        or: mock(() => chainableObj),
        filter: mock(() => chainableObj),
        order: mock(() => chainableObj),
        limit: mock(() => chainableObj),
        range: mock(() => chainableObj),
        single: mock(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: mock(() => Promise.resolve({ data: null, error: null })),
        then: mock((resolve: Function) => {
          resolve({ data: null, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return chainableObj;
    }),
    
    functions: {
      invoke: mock(async (functionName: string, options?: any) => {
        return { data: null, error: null };
      }),
    },
    
    auth: {
      getUser: mock(async () => ({ data: { user: null }, error: null })),
      getSession: mock(async () => ({ data: { session: null }, error: null })),
      signIn: mock(async () => ({ data: null, error: null })),
      signOut: mock(async () => ({ error: null })),
      onAuthStateChange: mock(() => ({ data: { subscription: { unsubscribe: mock() } } })),
    },
    
    storage: {
      from: mock((bucket: string) => ({
        upload: mock(async () => ({ data: null, error: null })),
        download: mock(async () => ({ data: null, error: null })),
        remove: mock(async () => ({ data: null, error: null })),
        list: mock(async () => ({ data: null, error: null })),
        getPublicUrl: mock(() => ({ data: { publicUrl: 'https://example.com/file' } })),
      })),
    },
  };

  return mockClient;
};

// Mock for createSupabaseServerClient
export const mockCreateSupabaseServerClient = mock(() => createMockSupabaseClient());

// Mock for createSupabaseServiceRoleClient
export const mockCreateSupabaseServiceRoleClient = mock(() => createMockSupabaseClient());

// Helper to set up Supabase response
export const setupSupabaseResponse = (
  client: ReturnType<typeof createMockSupabaseClient>,
  table: string,
  operation: string,
  response: { data?: any; error?: any }
) => {
  const fromMock = client.from as any;
  const tableMock = fromMock.mock.calls.find((call: any[]) => call[0] === table);
  
  if (tableMock) {
    const chainableObj = fromMock.mock.results[fromMock.mock.calls.indexOf(tableMock)].value;
    const operationMock = chainableObj[operation] as any;
    
    if (operation === 'single' || operation === 'maybeSingle') {
      operationMock.mockImplementationOnce(() => Promise.resolve(response));
    } else {
      chainableObj.then = mock((resolve: Function) => {
        resolve(response);
        return Promise.resolve(response);
      });
    }
  }
};

// Helper to create a chainable mock that returns a specific response
export const createChainableMock = (finalResponse: { data?: any; error?: any }) => {
  const chainableObj: any = {
    select: mock(() => chainableObj),
    insert: mock(() => chainableObj),
    update: mock(() => chainableObj),
    upsert: mock(() => chainableObj),
    delete: mock(() => chainableObj),
    eq: mock(() => chainableObj),
    neq: mock(() => chainableObj),
    gt: mock(() => chainableObj),
    gte: mock(() => chainableObj),
    lt: mock(() => chainableObj),
    lte: mock(() => chainableObj),
    like: mock(() => chainableObj),
    ilike: mock(() => chainableObj),
    is: mock(() => chainableObj),
    in: mock(() => chainableObj),
    contains: mock(() => chainableObj),
    containedBy: mock(() => chainableObj),
    not: mock(() => chainableObj),
    or: mock(() => chainableObj),
    filter: mock(() => chainableObj),
    order: mock(() => chainableObj),
    limit: mock(() => chainableObj),
    range: mock(() => chainableObj),
    single: mock(() => Promise.resolve(finalResponse)),
    maybeSingle: mock(() => Promise.resolve(finalResponse)),
    then: mock((resolve: Function) => {
      resolve(finalResponse);
      return Promise.resolve(finalResponse);
    }),
  };
  return chainableObj;
};