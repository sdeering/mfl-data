import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider } from '../contexts/ThemeContext'
import SettingsPage from '../../app/settings/page'

jest.mock('../utils/themeStorage', () => ({
  saveThemePreference: jest.fn(),
  getInitialThemePreference: jest.fn(() => 'dark'),
}))

const { saveThemePreference } = jest.requireMock('../utils/themeStorage')

describe('Settings', () => {
  it('switches between dark and light mode, and remembers the choice', () => {
    render(
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    )
    const darkMode = screen.getByRole('switch', { name: 'Dark mode' })
    expect(darkMode).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveClass('dark')

    fireEvent.click(darkMode)
    expect(darkMode).toHaveAttribute('aria-checked', 'false')
    expect(document.documentElement).toHaveClass('light')
    expect(saveThemePreference).toHaveBeenCalledWith('light')
  })
})
