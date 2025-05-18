"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { ExternalLink, Plus, ChevronLeft, ChevronRight, MoreVertical, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Source } from "@/types/source"

// Number of sources to show per page (3 per row, 2 rows)
const SOURCES_PER_PAGE = 6

export function SourcesContent() {
  const [sources, setSources] = useState<Source[]>([])
  const [newSourceUrl, setNewSourceUrl] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [removingSourceId, setRemovingSourceId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Minimum swipe distance (in pixels)
  const MIN_SWIPE_DISTANCE = 50

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(sources.length / SOURCES_PER_PAGE)
  }, [sources.length])

  // Get current sources for the page
  const currentSources = useMemo(() => {
    const startIndex = (currentPage - 1) * SOURCES_PER_PAGE
    return sources.slice(startIndex, startIndex + SOURCES_PER_PAGE)
  }, [sources, currentPage])

  // Create placeholder sources to fill the grid
  const placeholders = useMemo(() => {
    if (currentSources.length === 0 || currentSources.length === SOURCES_PER_PAGE) return []
    return Array(SOURCES_PER_PAGE - currentSources.length).fill(null)
  }, [currentSources.length])

  // Helper function to parse JSON response and extract detail field
  const parseErrorResponse = async (response: Response): Promise<string> => {
    try {
      const text = await response.text()

      try {
        // Try to parse as JSON
        const data = JSON.parse(text)
        // If it has a detail field, return that
        if (data && data.detail) {
          return data.detail
        }
        // Otherwise return the text as is
        return text
      } catch {
        // If it's not valid JSON, return the text as is
        return text
      }
    } catch (error) {
      // If we can't read the response at all
      return "An error occurred. Please try again."
    }
  }

  // Fetch sources from API
  useEffect(() => {
    const fetchSources = async () => {
      setIsLoading(true)

      try {
        const response = await fetch("http://127.0.0.1:8000/sources")

        if (!response.ok) {
          const errorMessage = await parseErrorResponse(response)
          toast.error(errorMessage)
          throw new Error(errorMessage)
        }

        const data = await response.json()
        setSources(data)
      } catch (err) {
        console.error("Failed to fetch sources:", err)
        // Only show the generic network error if we haven't already shown a more specific error
        // and if it's a network error (not a response error we've already handled)
        if (err instanceof Error && err.name === "TypeError" && err.message.includes("fetch")) {
          toast.error("Could not connect to the server. Please check your connection.")
        }
        // Ensure sources is an empty array on error
        setSources([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchSources()
  }, [])

  // Format date function
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, "PPP 'at' p") // Format: May 15, 2023 at 2:30 PM
    } catch (error) {
      return "Invalid date"
    }
  }

  // Handle form submission
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newSourceUrl.trim()) return

    setIsAdding(true)

    try {
      const response = await fetch("http://127.0.0.1:8000/add_source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: newSourceUrl }),
      })

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response)
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }

      // Success! Show success toast
      toast.success("Source added successfully")

      // Fetch updated sources list
      const sourcesResponse = await fetch("http://127.0.0.1:8000/sources")
      if (!sourcesResponse.ok) {
        // Just log this error, we already added the source successfully
        console.error("Error refreshing sources list")
      } else {
        const updatedSources = await sourcesResponse.json()
        setSources(updatedSources)
        // Go to the last page to see the new source
        setCurrentPage(Math.ceil(updatedSources.length / SOURCES_PER_PAGE))
      }

      setNewSourceUrl("")
    } catch (err) {
      console.error("Failed to add source:", err)

      // Only show the generic network error if we haven't already shown a more specific error
      // and if it's a network error (not a response error we've already handled)
      if (err instanceof Error && err.name === "TypeError" && err.message.includes("fetch")) {
        toast.error("Could not connect to the server. Please check your connection.")
      }
    } finally {
      setIsAdding(false)
    }
  }

  // Handle source removal
  const handleRemoveSource = async (sourceId: number) => {
    setRemovingSourceId(sourceId)

    try {
      const response = await fetch("http://127.0.0.1:8000/remove_resource", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: sourceId }),
      })

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response)
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }

      // Success! Show success toast
      toast.success("Source removed successfully")

      // Update local state by removing the source
      setSources((prevSources) => prevSources.filter((source) => source.id !== sourceId))

      // Adjust current page if needed (if we're on the last page and it's now empty)
      const newTotalPages = Math.ceil((sources.length - 1) / SOURCES_PER_PAGE)
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages)
      }
    } catch (err) {
      console.error("Failed to remove source:", err)

      // Only show the generic network error if we haven't already shown a more specific error
      // and if it's a network error (not a response error we've already handled)
      if (err instanceof Error && err.name === "TypeError" && err.message.includes("fetch")) {
        toast.error("Could not connect to the server. Please check your connection.")
      }
    } finally {
      setRemovingSourceId(null)
    }
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    // Scroll to top of sources section
    document.getElementById("sources-grid")?.scrollIntoView({ behavior: "smooth" })
  }

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset
    setTouchStart(e.targetTouches[0].clientX)
  }

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  // Handle touch end
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isSignificantSwipe = Math.abs(distance) > MIN_SWIPE_DISTANCE

    if (isSignificantSwipe) {
      if (distance > 0) {
        // Swiped left, go to next page
        handlePageChange(currentPage + 1)
      } else {
        // Swiped right, go to previous page
        handlePageChange(currentPage - 1)
      }
    }

    // Reset values
    setTouchStart(null)
    setTouchEnd(null)
  }

  // Handle mouse down (for desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEnd(null) // Reset
    setTouchStart(e.clientX)
  }

  // Handle mouse move (for desktop)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStart) return
    setTouchEnd(e.clientX)
  }

  // Handle mouse up (for desktop)
  const handleMouseUp = () => {
    handleTouchEnd() // Reuse the same logic
  }

  // Handle mouse leave (for desktop)
  const handleMouseLeave = () => {
    // Reset everything if mouse leaves the element
    setTouchStart(null)
    setTouchEnd(null)
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Push content down closer to middle */}
      <div className="pt-20"></div>

      {/* Header and form section - horizontally centered */}
      <div className="flex justify-center mb-10">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">My News Sources</h1>

          {/* Add source form - inline with just + icon */}
          <form onSubmit={handleAddSource} className="flex w-full items-center gap-2">
            <Input
              type="url"
              placeholder="Enter source URL (e.g., https://example.com)"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              className="h-14 flex-1 rounded-full px-6 text-center text-lg"
              required
              disabled={isAdding}
            />
            <Button
              type="submit"
              disabled={isAdding}
              className="h-12 w-12 rounded-full p-0 flex items-center justify-center" // Smaller button
              aria-label="Add source"
            >
              {isAdding ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Plus className="h-5 w-5" /> // Smaller icon
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Sources grid with fixed height container */}
      <div id="sources-grid" className="w-full flex justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-lg text-muted-foreground">No sources found. Add your first source above.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-7xl">
            {/* Fixed height container for sources grid with swipe functionality - no moving effect */}
            <div
              ref={gridRef}
              className="min-h-[500px] w-full mb-8 relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {/* Actual sources */}
                {currentSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex flex-col rounded-lg border p-6 shadow-sm transition-all hover:shadow-md relative"
                  >
                    {/* 3-dot menu */}
                    <div className="absolute top-4 right-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive flex items-center gap-2"
                            onClick={() => handleRemoveSource(source.id)}
                            disabled={removingSourceId === source.id}
                          >
                            {removingSourceId === source.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            {removingSourceId === source.id ? "Removing..." : "Remove"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h2 className="text-xl font-semibold text-primary truncate pr-8">{source.name}</h2>

                    <div className="mt-3 flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Created:</span> {formatDate(source.creation_timestamp)}
                      </p>

                      <a
                        href={source.root_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        Visit Website <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}

                {/* Invisible placeholders to maintain grid structure */}
                {placeholders.map((_, index) => (
                  <div key={`placeholder-${index}`} className="invisible" aria-hidden="true" />
                ))}
              </div>
            </div>

            {/* Pagination with bubbles and arrows next to them */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 rounded-full p-0"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`h-3 w-3 rounded-full transition-all ${
                          currentPage === page ? "bg-primary scale-125" : "bg-muted hover:bg-primary/50"
                        }`}
                        aria-label={`Go to page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                      />
                    )
                  })}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 rounded-full p-0"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
