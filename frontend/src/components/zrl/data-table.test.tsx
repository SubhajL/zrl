import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from './data-table';

interface TestRow {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

const columns: Column<TestRow>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status' },
];

const data: TestRow[] = [
  { id: '1', name: 'Lane Alpha', status: 'Active' },
  { id: '2', name: 'Lane Beta', status: 'Pending' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Lane Alpha')).toBeInTheDocument();
    expect(screen.getByText('Lane Beta')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No lanes found"
      />,
    );
    expect(screen.getByText('No lanes found')).toBeInTheDocument();
  });

  it('toggles sort direction on header click', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    const nameHeader = screen.getByText('Name').closest('th');

    await user.click(nameHeader!);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await user.click(nameHeader!);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('calls onRowClick when row is clicked', async () => {
    const user = userEvent.setup();
    const handleRowClick = jest.fn();
    render(
      <DataTable columns={columns} data={data} onRowClick={handleRowClick} />,
    );

    await user.click(screen.getByText('Lane Alpha'));
    expect(handleRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('renders non-sortable headers without sort icon', () => {
    render(<DataTable columns={columns} data={data} />);
    // ID column is not sortable
    const idHeader = screen.getByText('ID').closest('th');
    // The sortable Name column has an SVG (ArrowUpDown), but ID should not
    const idSvg = idHeader?.querySelector('svg');
    expect(idSvg).toBeNull();
  });
});
