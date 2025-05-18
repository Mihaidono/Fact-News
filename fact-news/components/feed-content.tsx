"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CalendarIcon,
  Filter,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

import type { Article } from "@/types/article";
import type { Source } from "@/types/source";

// Number of articles to show per page
const ARTICLES_PER_PAGE = 6;

export function FeedContent() {
  // State for articles and loading
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedArticles, setExpandedArticles] = useState<
    Record<number, boolean>
  >({});
  const [factCheckingArticle, setFactCheckingArticle] = useState<number | null>(
    null
  );

  // State for filters
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<
    "all" | "today" | "week" | "month"
  >("all");

  // State for search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const paginationRef = useRef<HTMLDivElement>(null);

  // Fetch articles and sources
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch sources first
        const sourcesResponse = await fetch("http://127.0.0.1:8000/sources");
        if (!sourcesResponse.ok) {
          throw new Error("Failed to fetch sources");
        }
        const sourcesData = await sourcesResponse.json();
        setSources(sourcesData);

        // Build query params for articles
        const params = new URLSearchParams();

        // Add time_period if no specific date is selected
        if (!selectedDate) {
          params.append("time_period", timePeriod);
        }

        // Add selected_date if available (overrides time_period)
        if (selectedDate) {
          params.append("selected_date", format(selectedDate, "yyyy-MM-dd"));
        }

        // Add source_id if available
        if (selectedSource) {
          params.append("source_id", selectedSource.toString());
        }

        // Add search term if available
        if (searchQuery) {
          params.append("search", searchQuery);
        }

        // Add pagination parameters
        params.append("page", currentPage.toString());
        params.append("page_size", ARTICLES_PER_PAGE.toString());

        // Fetch articles with filters
        const articlesResponse = await fetch(
          `http://127.0.0.1:8000/articles?${params.toString()}`
        );
        if (!articlesResponse.ok) {
          throw new Error("Failed to fetch articles");
        }

        // Parse response - note the "detail" wrapper in the response
        const responseData = await articlesResponse.json();
        setArticles(responseData.detail || []);

        // Set total articles count from response headers or metadata
        // This assumes the API returns a total count. Adjust as needed.
        if (responseData.total) {
          setTotalArticles(responseData.total);
        } else {
          // If API doesn't return total, use the current articles length
          // This is a fallback and might not be accurate for all pages
          setTotalArticles(responseData.detail?.length || 0);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load articles. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedSource, selectedDate, timePeriod, searchQuery, currentPage]);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchTerm);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Toggle article expansion
  const toggleArticleExpansion = (articleId: number) => {
    setExpandedArticles((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  // Handle fact checking
  const handleFactCheck = async (articleId: number) => {
    setFactCheckingArticle(articleId);
    try {
      const response = await fetch("http://127.0.0.1:8000/fact_check_article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: articleId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fact check article");
      }

      const updatedArticle = await response.json();

      // Update the article in the state
      setArticles((prevArticles) =>
        prevArticles.map((article) =>
          article.id === articleId
            ? {
                ...article,
                fact_checked: true,
                fact_summary: updatedArticle.fact_summary,
              }
            : article
        )
      );

      toast.success("Article fact-checked successfully");
    } catch (error) {
      console.error("Error fact checking article:", error);
      toast.error("Failed to fact check article. Please try again.");
    } finally {
      setFactCheckingArticle(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "PPP 'at' p"); // Format: May 15, 2023 at 2:30 PM
    } catch (error) {
      return "Invalid date";
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedSource(null);
    setSelectedDate(null);
    setTimePeriod("all");
    setSearchTerm("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Get source name by ID
  const getSourceName = (sourceOrId: number | { id: number; name: string }) => {
    const sourceId =
      typeof sourceOrId === "number" ? sourceOrId : sourceOrId.id;
    const source = sources.find((s) => s.id === sourceId);
    return source ? source.name : "Unknown Source";
  };

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalArticles / ARTICLES_PER_PAGE));

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);

    // Scroll to top of articles section
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];

    // Always show first page
    items.push(
      <Button
        key="page-1"
        variant={currentPage === 1 ? "default" : "outline"}
        size="icon"
        className="h-8 w-8"
        onClick={() => handlePageChange(1)}
        aria-label="Page 1"
      >
        1
      </Button>
    );

    // If there are many pages, add ellipsis
    if (currentPage > 3) {
      items.push(
        <span key="ellipsis-1" className="px-2">
          ...
        </span>
      );
    }

    // Add pages around current page
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      if (i === 1 || i === totalPages) continue; // Skip first and last page as they're always shown

      items.push(
        <Button
          key={`page-${i}`}
          variant={currentPage === i ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePageChange(i)}
          aria-label={`Page ${i}`}
        >
          {i}
        </Button>
      );
    }

    // If there are many pages, add ellipsis
    if (currentPage < totalPages - 2) {
      items.push(
        <span key="ellipsis-2" className="px-2">
          ...
        </span>
      );
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      items.push(
        <Button
          key={`page-${totalPages}`}
          variant={currentPage === totalPages ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePageChange(totalPages)}
          aria-label={`Page ${totalPages}`}
        >
          {totalPages}
        </Button>
      );
    }

    return items;
  };

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="pt-10"></div>

      {/* Header and search section */}
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-bold mb-6">My News Feed</h1>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex w-full max-w-3xl mb-6 gap-2"
        >
          <Input
            type="text"
            placeholder="Search articles by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button type="submit">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-3xl mb-4">
          {/* Source filter */}
          <Select
            value={selectedSource?.toString() || "all"}
            onValueChange={(value) =>
              setSelectedSource(value === "all" ? null : Number(value))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id.toString()}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date filter - directly using Calendar in a Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="rounded-md border"
              />
              {selectedDate && (
                <div className="p-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(null)}
                    className="w-full"
                  >
                    Clear Date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Time period filter - only enabled when no specific date is selected */}
          <Select
            value={timePeriod}
            onValueChange={(value: "all" | "today" | "week" | "month") =>
              setTimePeriod(value)
            }
            disabled={!!selectedDate}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset filters button */}
          <Button variant="ghost" onClick={resetFilters} className="gap-2">
            <Filter className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>

        {/* Active filters display */}
        {(selectedSource ||
          selectedDate ||
          timePeriod !== "all" ||
          searchQuery) && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {selectedSource && (
              <Badge variant="secondary" className="px-3 py-1">
                Source: {getSourceName(selectedSource)}
              </Badge>
            )}
            {selectedDate && (
              <Badge variant="secondary" className="px-3 py-1">
                Date: {format(selectedDate, "PP")}
              </Badge>
            )}
            {!selectedDate && timePeriod !== "all" && (
              <Badge variant="secondary" className="px-3 py-1">
                Period:{" "}
                {timePeriod === "today"
                  ? "Today"
                  : timePeriod === "week"
                  ? "This Week"
                  : "This Month"}
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="px-3 py-1">
                Search: {searchQuery}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Articles section */}
      <div className="w-full max-w-4xl mx-auto">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mx-auto" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-4 w-1/3" />
              </CardFooter>
            </Card>
          ))
        ) : articles.length === 0 ? (
          // No articles found
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-muted-foreground">
              No articles found
            </h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          // Article cards
          articles.map((article) => (
            <Card key={article.id} className="mb-6 relative">
              {/* Fact check button */}
              {!article.fact_checked && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-100"
                        onClick={() => handleFactCheck(article.id)}
                        disabled={factCheckingArticle === article.id}
                      >
                        {factCheckingArticle === article.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Fact check this article</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <CardHeader>
                <CardTitle className="text-center text-xl">
                  {article.title}
                </CardTitle>
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>Source: {getSourceName(article.source)}</span>
                  <span>{formatDate(article.pub_date)}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description or content based on expansion state */}
                <div
                  className={
                    expandedArticles[article.id] ? "text-left" : "text-justify"
                  }
                >
                  {expandedArticles[article.id]
                    ? article.content
                    : article.description || "No description available."}
                </div>

                {/* Fact summary if available */}
                {article.fact_checked && article.fact_summary && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      Fact Check Summary
                    </h4>
                    <p className="text-sm">{article.fact_summary}</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => toggleArticleExpansion(article.id)}
                >
                  {expandedArticles[article.id] ? (
                    <>
                      <ChevronUp className="h-4 w-4" /> Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" /> View More
                    </>
                  )}
                </Button>

                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit Source <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))
        )}

        {/* Pagination */}
        {!isLoading && articles.length > 0 && (
          <div
            ref={paginationRef}
            className="flex justify-center items-center gap-2 py-8"
          >
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPaginationItems()}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
