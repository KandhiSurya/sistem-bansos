import '@testing-library/jest-dom';
import React from 'react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn().mockReturnValue('mock-toast-id'),
    dismiss: jest.fn(),
  },
}));

// Mock browser-image-compression
jest.mock('browser-image-compression', () => {
  return jest.fn().mockImplementation((file) => Promise.resolve(file));
});

// Mock exceljs & file-saver
jest.mock('exceljs', () => {
  class MockWorksheet {
    constructor() {
      this.columns = [];
      this.rows = [];
    }
    addRow(row) {
      this.rows.push(row);
    }
    getRow() {
      return { font: {}, alignment: {} };
    }
  }
  class MockWorkbook {
    constructor() {
      this.worksheets = [];
    }
    addWorksheet(name) {
      const ws = new MockWorksheet();
      this.worksheets.push(ws);
      return ws;
    }
    xlsx = {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from([])),
    };
  }
  return {
    Workbook: MockWorkbook,
  };
});

jest.mock('file-saver', () => ({
  saveAs: jest.fn(),
}));

// Mock recharts
jest.mock('recharts', () => {
  const Dummy = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    PieChart: Dummy,
    Pie: Dummy,
    Cell: Dummy,
    BarChart: Dummy,
    Bar: Dummy,
    XAxis: Dummy,
    YAxis: Dummy,
    CartesianGrid: Dummy,
    Tooltip: Dummy,
    Legend: Dummy,
  };
});

// Mock Supabase client globally
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockSelect = jest.fn().mockReturnThis();
const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = jest.fn().mockReturnThis();
const mockDelete = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockNeq = jest.fn().mockReturnThis();
const mockIlike = jest.fn().mockReturnThis();
const mockNot = jest.fn().mockReturnThis();
const mockIn = jest.fn().mockReturnThis();

const mockSingleChain = {
  select: mockSelect,
  eq: mockEq,
  neq: mockNeq,
  ilike: mockIlike,
  not: mockNot,
  in: mockIn,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnValue(mockSingleChain),
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } } }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://test-url.com/file' } }),
        remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }),
    },
  },
}));

// Export supabase chains to be accessible for test-specific overrides if needed
global.supabaseMockChain = mockSingleChain;