import '@testing-library/jest-dom'
import '@testing-library/react'

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
})

// Mock scrollTo
window.scrollTo = () => { }

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = () => { }
    unobserve = () => { }
    disconnect = () => { }
}
window.IntersectionObserver = MockIntersectionObserver as any
