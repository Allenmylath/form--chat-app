"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutList, MessageCircleQuestionMark, RotateCcw, ChevronLeft, ChevronRight, Mic, Send } from "lucide-react";

interface Option {
  id: string;
  label: string;
}

interface Question {
  id: string;
  text: string;
  type: "single" | "multi";
  options: Option[];
  required?: boolean;
}

interface FormAreaProps {
  initialQuestions?: Question[];
  className?: string;
  pipecatClient: {
    client: any;
    isConnected: boolean;
    isConnecting: boolean;
    isBotReady: boolean;
    isBotSpeaking: boolean;
    isUserSpeaking: boolean;
    messages: Array<{
      id: string;
      type: 'user' | 'bot' | 'system';
      content: string;
      timestamp: Date;
    }>;
    error: string | null;
    sendMessage: (msgType: string, data: any) => void;
    sendRequest: (msgType: string, data: any) => Promise<any>;
    clearMessages: () => void;
  };
}

const defaultQuestions: Question[] = [
  {
    id: "q1",
    text: "What is your preferred programming language?",
    type: "single",
    required: true,
    options: [
      { id: "js", label: "JavaScript" },
      { id: "py", label: "Python" },
      { id: "ts", label: "TypeScript" },
      { id: "java", label: "Java" },
    ],
  },
  {
    id: "q2",
    text: "Which frameworks have you used? (Select all that apply)",
    type: "multi",
    options: [
      { id: "react", label: "React" },
      { id: "vue", label: "Vue.js" },
      { id: "angular", label: "Angular" },
      { id: "svelte", label: "Svelte" },
    ],
  },
];

export default function FormArea({ initialQuestions, className, pipecatClient }: FormAreaProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions || defaultQuestions);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    sendMessage,
    sendRequest,
  } = pipecatClient;

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentQuestionIndex, answers]);

  const handleSingleSelect = async (questionId: string, value: string) => {
    const newAnswers = {
      ...answers,
      [questionId]: value
    };
    setAnswers(newAnswers);

    // Send answer to Pipecat server if connected
    if (isConnected && isBotReady) {
      try {
        const currentQuestion = questions.find(q => q.id === questionId);
        const selectedOption = currentQuestion?.options.find(opt => opt.id === value);
        
        sendMessage('form-answer', {
          questionId,
          questionText: currentQuestion?.text,
          answerValue: value,
          answerLabel: selectedOption?.label,
          type: 'single'
        });
        
        toast.success("Answer sent to assistant");
      } catch (err: any) {
        toast.error("Failed to send answer to assistant");
      }
    }
  };

  const handleMultiSelect = async (questionId: string, optionId: string, checked: boolean) => {
    const currentAnswers = (answers[questionId] as string[]) || [];
    let newAnswers;
    
    if (checked) {
      newAnswers = {
        ...answers,
        [questionId]: [...currentAnswers, optionId]
      };
    } else {
      newAnswers = {
        ...answers,
        [questionId]: currentAnswers.filter(id => id !== optionId)
      };
    }
    
    setAnswers(newAnswers);

    // Send updated answers to Pipecat server if connected
    if (isConnected && isBotReady) {
      try {
        const currentQuestion = questions.find(q => q.id === questionId);
        const selectedOptions = (newAnswers[questionId] as string[])
          .map(id => currentQuestion?.options.find(opt => opt.id === id)?.label)
          .filter(Boolean);

        sendMessage('form-answer', {
          questionId,
          questionText: currentQuestion?.text,
          answerValue: newAnswers[questionId],
          answerLabels: selectedOptions,
          type: 'multi'
        });
        
        toast.success("Answer updated for assistant");
      } catch (err: any) {
        toast.error("Failed to send answer to assistant");
      }
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Add new question when at the end
      const newQuestion: Question = {
        id: `q${Date.now()}`,
        text: "What development tools do you prefer?",
        type: "multi",
        options: [
          { id: "vscode", label: "VS Code" },
          { id: "webstorm", label: "WebStorm" },
          { id: "atom", label: "Atom" },
          { id: "sublime", label: "Sublime Text" },
        ],
      };
      
      setQuestions(prev => [...prev, newQuestion]);
      setCurrentQuestionIndex(prev => prev + 1);
      toast.success("New question added!");
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const validateCurrentQuestion = (): boolean => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion?.required) return true;

    const answer = answers[currentQuestion.id];
    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      toast.error(`Please answer: ${currentQuestion.text}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateCurrentQuestion()) return;

    setIsLoading(true);
    
    try {
      // Send form data to Pipecat server if connected
      if (isConnected && isBotReady) {
        const formData = questions.map(question => ({
          id: question.id,
          question: question.text,
          type: question.type,
          answer: answers[question.id],
          answerLabels: question.type === 'multi' 
            ? (answers[question.id] as string[])?.map(id => 
                question.options.find(opt => opt.id === id)?.label
              ).filter(Boolean)
            : question.options.find(opt => opt.id === answers[question.id])?.label
        }));

        await sendRequest('form-submit', {
          formData,
          timestamp: new Date().toISOString(),
          totalQuestions: questions.length,
          answeredQuestions: getAnsweredCount()
        });
        
        toast.success("Form submitted to assistant successfully!");
      } else {
        // Simulate API call when not connected
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success("Form submitted successfully!");
      }
      
      setIsSubmitted(true);
    } catch (err: any) {
      toast.error("Failed to submit form. Please try again.");
      setError("Submission failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setIsSubmitted(false);
    setError(null);
    
    // Notify assistant about form reset
    if (isConnected && isBotReady) {
      sendMessage('form-reset', {
        timestamp: new Date().toISOString()
      });
    }
    
    toast.success("Form reset");
  };

  const handleSendToAssistant = async () => {
    if (!isConnected || !isBotReady) {
      toast.error("Assistant not connected");
      return;
    }

    try {
      const currentQuestion = questions[currentQuestionIndex];
      await sendRequest('form-question-help', {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        questionType: currentQuestion.type,
        options: currentQuestion.options,
        currentAnswer: answers[currentQuestion.id],
        currentQuestionIndex: currentQuestionIndex + 1,
        totalQuestions: questions.length
      });
      
      toast.success("Question sent to assistant for help");
    } catch (err: any) {
      toast.error("Failed to get help from assistant");
    }
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).filter(key => {
      const answer = answers[key];
      return answer && (Array.isArray(answer) ? answer.length > 0 : true);
    }).length;
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <MessageCircleQuestionMark className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => setError(null)} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <LayoutList className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Interactive Form
              {isUserSpeaking && <Mic className="w-4 h-4 text-green-600 animate-pulse" />}
              {isBotSpeaking && <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />}
            </CardTitle>
            <CardDescription>
              Question {currentQuestionIndex + 1} of {questions.length}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {getAnsweredCount()}/{questions.length} answered
            </div>
            {isConnected && isBotReady && (
              <Badge variant="secondary" className="text-xs">
                Assistant Ready
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
          <div className="py-6">
            {isLoading && (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-8 bg-muted/60 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && questions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircleQuestionMark className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Questions Available</h3>
                <p className="text-muted-foreground mb-6">
                  Get started by adding your first question
                </p>
                <Button onClick={handleNext}>
                  Add First Question
                </Button>
              </div>
            )}

            {!isLoading && currentQuestion && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                      {currentQuestionIndex + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Label className="text-lg font-semibold leading-relaxed">
                          {currentQuestion.text}
                          {currentQuestion.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {isConnected && isBotReady && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSendToAssistant}
                            className="gap-1 text-xs"
                          >
                            <Send className="w-3 h-3" />
                            Ask Assistant
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-11">
                    {currentQuestion.type === "single" ? (
                      <RadioGroup
                        value={answers[currentQuestion.id] as string || ""}
                        onValueChange={(value) => handleSingleSelect(currentQuestion.id, value)}
                        className="space-y-3"
                      >
                        {currentQuestion.options.map((option) => (
                          <div key={option.id} className="flex items-center space-x-3">
                            <RadioGroupItem value={option.id} id={`${currentQuestion.id}-${option.id}`} />
                            <Label
                              htmlFor={`${currentQuestion.id}-${option.id}`}
                              className="flex-1 py-3 px-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 data-[state=checked]:bg-primary/10 data-[state=checked]:border-primary text-base"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="space-y-3">
                        {currentQuestion.options.map((option) => {
                          const isChecked = ((answers[currentQuestion.id] as string[]) || []).includes(option.id);
                          return (
                            <div key={option.id} className="flex items-center space-x-3">
                              <Checkbox
                                id={`${currentQuestion.id}-${option.id}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => 
                                  handleMultiSelect(currentQuestion.id, option.id, checked as boolean)
                                }
                              />
                              <Label
                                htmlFor={`${currentQuestion.id}-${option.id}`}
                                className={`flex-1 py-3 px-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 text-base ${
                                  isChecked ? 'bg-primary/10 border-primary' : ''
                                }`}
                              >
                                {option.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {isSubmitted && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">
                      ✓ Form submitted successfully! {isConnected && isBotReady ? "Data sent to assistant." : "Thank you for your responses."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-card p-6 space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              {!isLastQuestion ? (
                <Button
                  onClick={handleNext}
                  size="sm"
                  disabled={isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  Add Question
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          
          <div className="flex gap-3">
            {isLastQuestion && (
              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={isLoading || questions.length === 0}
              >
                {isLoading ? "Submitting..." : isConnected && isBotReady ? "Submit to Assistant" : "Submit Form"}
              </Button>
            )}
          </div>
          
          {isConnected && isBotReady && (
            <p className="text-xs text-muted-foreground text-center">
              Your answers are automatically shared with the voice assistant
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}