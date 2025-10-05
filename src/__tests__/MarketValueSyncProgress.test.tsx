import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarketValueSyncProgress from '../components/MarketValueSyncProgress';

// Mock fetch
global.fetch = jest.fn();

describe('MarketValueSyncProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when jobId is null', () => {
    render(<MarketValueSyncProgress jobId={null} />);
    expect(screen.queryByText('Market Value Sync')).not.toBeInTheDocument();
  });

  it('should render sync progress modal when jobId is provided', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'running',
      progress: 1,
      total: 3,
      percentage: 33,
      currentPlayer: 'Calculating market value for player 116267 (1/3)',
      results: []
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    render(<MarketValueSyncProgress jobId="test-job-123" />);

    await waitFor(() => {
      expect(screen.getByText('Market Value Sync')).toBeInTheDocument();
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 players processed (33%)')).toBeInTheDocument();
    expect(screen.getByText('Calculating market value for player 116267 (1/3)')).toBeInTheDocument();
  });

  it('should show completed status with results', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'completed',
      progress: 2,
      total: 2,
      percentage: 100,
      currentPlayer: 'Sync completed',
      results: [
        { playerId: '116267', marketValue: 171, success: true },
        { playerId: '116268', marketValue: 0, success: false }
      ]
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    const onComplete = jest.fn();
    render(<MarketValueSyncProgress jobId="test-job-123" onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    expect(screen.getByText('Successful: 1')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(mockJob.results);
  });

  it('should show failed status with error message', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'failed',
      progress: 0,
      total: 2,
      percentage: 0,
      error: 'API rate limit exceeded',
      results: []
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    render(<MarketValueSyncProgress jobId="test-job-123" />);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Error: API rate limit exceeded')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'running',
      progress: 1,
      total: 2,
      percentage: 50,
      results: []
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    const onClose = jest.fn();
    render(<MarketValueSyncProgress jobId="test-job-123" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Market Value Sync')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('✕');
    closeButton.click();

    expect(onClose).toHaveBeenCalled();
  });

  it('should show Done button when completed', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'completed',
      progress: 2,
      total: 2,
      percentage: 100,
      results: []
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    const onClose = jest.fn();
    render(<MarketValueSyncProgress jobId="test-job-123" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    const doneButton = screen.getByText('Done');
    doneButton.click();

    expect(onClose).toHaveBeenCalled();
  });

  it('should show Close button when failed', async () => {
    const mockJob = {
      jobId: 'test-job-123',
      status: 'failed',
      progress: 0,
      total: 2,
      percentage: 0,
      error: 'Test error',
      results: []
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob
    });

    const onClose = jest.fn();
    render(<MarketValueSyncProgress jobId="test-job-123" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('Close');
    closeButton.click();

    expect(onClose).toHaveBeenCalled();
  });
});
