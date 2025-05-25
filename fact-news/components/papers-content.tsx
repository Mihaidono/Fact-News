"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Paper } from "@/types/paper";

export function PapersContent() {
  const [paper, setPaper] = useState<Paper>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [factCheckingPaper, setFactCheckingPaper] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const date = selectedDate || new Date();
        const formattedDate = format(date, "yyyy-MM-dd");
        const params = new URLSearchParams({ date: formattedDate });

        let paperResponse = await fetch(`http://127.0.0.1:8000/papers?${params.toString()}`);

        // If not found, generate paper
        if (paperResponse.status === 404) {
          const generateResponse = await fetch("http://127.0.0.1:8000/generate_paper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: formattedDate }),
          });

          if (!generateResponse.ok) {
            throw new Error("Failed to generate paper");
          }

          // Retry fetch after generation
          paperResponse = await fetch(`http://127.0.0.1:8000/papers?${params.toString()}`);
        }

        if (!paperResponse.ok) {
          throw new Error("Failed to fetch paper");
        }

        const responseData = await paperResponse.json();
        setPaper(responseData); // assume response is the paper directly
      } catch (error) {
        console.error("Error fetching or generating paper:", error);
        toast.error("Could not load or generate paper.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  const handleFactCheck = async (paperId: number) => {
    setFactCheckingPaper(paperId);
    try {
      const response = await fetch("http://127.0.0.1:8000/fact_check_paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paperId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fact check paper");
      }

      const updatedPaper = await response.json();

      setPaper((prevPaper) =>
        prevPaper
          ? {
              ...prevPaper,
              fact_checked: true,
              fact_summary: updatedPaper.fact_summary,
            }
          : prevPaper
      );

      toast.success("Paper fact-checked successfully");
    } catch (error) {
      console.error("Error fact checking paper:", error);
      toast.error("Failed to fact check paper. Please try again.");
    } finally {
      setFactCheckingPaper(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "PPP");
    } catch {
      return "Invalid date";
    }
  };

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="pt-10" />

      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-bold mb-6">My News Feed</h1>

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
              selected={selectedDate ?? undefined}
              onSelect={setSelectedDate}
              initialFocus
              className="rounded-md border"
            />
            {selectedDate && (
              <div className="p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(undefined)}
                  className="w-full"
                >
                  Clear Date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {selectedDate && (
        <div className="flex justify-center mb-4">
          <Badge variant="secondary" className="px-3 py-1">
            Date: {format(selectedDate, "PP")}
          </Badge>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto">
        {isLoading ? (
          <Card className="mb-6">
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
        ) : paper ? (
          <Card className="mb-6 relative">
            {!paper.fact_checked && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-100"
                onClick={() => handleFactCheck(paper.id)}
                disabled={factCheckingPaper === paper.id}
              >
                {factCheckingPaper === paper.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CalendarIcon className="h-5 w-5" />
                )}
              </Button>
            )}

            <CardHeader>
              <CardTitle className="text-center text-xl">
                Paper ID: {paper.id}
              </CardTitle>
              <div className="flex justify-center text-sm text-muted-foreground mt-2">
                <span>{formatDate(paper.pub_date)}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-justify">
                {paper.content || "No content available."}
              </div>

              {paper.fact_checked && paper.fact_summary && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <h4 className="font-medium mb-1 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Fact Check Summary
                  </h4>
                  <p className="text-sm">{paper.fact_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-muted-foreground">
              No paper found
            </h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
