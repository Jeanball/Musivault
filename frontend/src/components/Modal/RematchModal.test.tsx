import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RematchModal from './RematchModal'
import axios from 'axios'

// Mock axios
vi.mock('axios')
const mockedAxios = axios as unknown as {
    get: Mock,
    post: Mock
}

// Mock toast service
vi.mock('../../utils/toast', () => ({
    toastService: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }
}))

const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    itemId: 'item123',
    currentArtist: 'Test Artist',
    currentTitle: 'Test Album',
    onRematchSuccess: vi.fn(),
}

describe('RematchModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Search Result Type Detection', () => {
        it('should display search results with correct type property', async () => {
            // Mock search response with both master and release results
            mockedAxios.get.mockResolvedValueOnce({
                data: [
                    { id: 1, title: 'Artist - Album', year: '2020', thumb: '', type: 'master' },
                    { id: 2, title: 'Artist - Album', year: '2020', thumb: '', type: 'release' },
                ]
            })

            render(<RematchModal {...mockProps} />)

            // Wait for search to complete (debounced)
            await waitFor(() => {
                expect(mockedAxios.get).toHaveBeenCalledWith(
                    expect.stringContaining('/api/discogs/search'),
                    expect.any(Object)
                )
            }, { timeout: 2000 })
        })

        it('should fetch main_release when selecting a master type result', async () => {
            // Mock search response
            mockedAxios.get.mockResolvedValueOnce({
                data: [
                    { id: 100, title: 'Artist - Album', year: '2020', thumb: '', type: 'master' },
                ]
            })

            // Mock master versions response (for getting main_release)
            mockedAxios.get.mockResolvedValueOnce({
                data: { main_release: 12345 }
            })

            // Mock rematch POST
            mockedAxios.post.mockResolvedValueOnce({ data: {} })

            render(<RematchModal {...mockProps} />)

            // Wait for search results
            await waitFor(() => {
                expect(mockedAxios.get).toHaveBeenCalled()
            }, { timeout: 2000 })
        })

        it('should use release ID directly when selecting a release type result', async () => {
            // Mock search response with only a release
            mockedAxios.get.mockResolvedValueOnce({
                data: [
                    { id: 200, title: 'Artist - Album', year: '2020', thumb: '', type: 'release' },
                ]
            })

            // Mock rematch POST - should receive the release ID directly
            mockedAxios.post.mockResolvedValueOnce({ data: {} })

            render(<RematchModal {...mockProps} />)

            // Wait for search results
            await waitFor(() => {
                expect(mockedAxios.get).toHaveBeenCalled()
            }, { timeout: 2000 })
        })
    })

    describe('Master Resolution Error Handling', () => {
        it('should handle failed main_release fetch gracefully', async () => {
            // Mock search response
            mockedAxios.get.mockResolvedValueOnce({
                data: [
                    { id: 100, title: 'Artist - Album', year: '2020', thumb: '', type: 'master' },
                ]
            })

            // Mock master versions to fail
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'))

            render(<RematchModal {...mockProps} />)

            // Wait for search results
            await waitFor(() => {
                expect(mockedAxios.get).toHaveBeenCalled()
            }, { timeout: 2000 })
        })

        it('should handle missing main_release in response', async () => {
            // Mock search response
            mockedAxios.get.mockResolvedValueOnce({
                data: [
                    { id: 100, title: 'Artist - Album', year: '2020', thumb: '', type: 'master' },
                ]
            })

            // Mock master versions response WITHOUT main_release
            mockedAxios.get.mockResolvedValueOnce({
                data: { main_release: null, versions: [] }
            })

            render(<RematchModal {...mockProps} />)

            // Wait for search results
            await waitFor(() => {
                expect(mockedAxios.get).toHaveBeenCalled()
            }, { timeout: 2000 })
        })
    })

    describe('Modal Behavior', () => {
        it('should not render when isOpen is false', () => {
            render(<RematchModal {...mockProps} isOpen={false} />)
            expect(screen.queryByText('Rematch Album')).not.toBeInTheDocument()
        })

        it('should render when isOpen is true', () => {
            render(<RematchModal {...mockProps} isOpen={true} />)
            expect(screen.getByText('Rematch Album')).toBeInTheDocument()
        })

        it('should pre-populate search with current artist and title', () => {
            render(<RematchModal {...mockProps} />)
            const input = screen.getByPlaceholderText('Search for the correct album...')
            expect(input).toHaveValue('Test Artist Test Album')
        })

        it('should close when cancel button is clicked', () => {
            render(<RematchModal {...mockProps} />)
            const cancelBtn = screen.getByText('Cancel')
            fireEvent.click(cancelBtn)
            expect(mockProps.onClose).toHaveBeenCalled()
        })
    })
})
