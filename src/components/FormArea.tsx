"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { LayoutList, HelpCircle, Send, Mic, CheckCircle2, Clock } from "lucide-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

interface QuizOption {
  label: string;
  text: string;
  score: number;
}

interface QuizQuestion {
  type: string;
  question_index: number;
  question_id: string;
  question_text: string;
  options: QuizOption[];
  total_questions: number;
}

interface UserAnswer {
  question_id: string;
  question_index: number;
  selected_option: QuizOption;
  timestamp: Date;
}

interface FormAreaProps {
  pipecatClient: any;
  className?: string;
}

interface ServerMessage {
  id: string;
  timestamp: Date;
  type: string;
  event?: string;
  data: any;
  raw: any;
}

export default function FormArea({ pipecatClient, className = "" }: FormAreaProps) {
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
  const [hasQuizStarted, setHasQuizStarted] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    appendToContext,
  } = pipecatClient;

  // Enhanced server message logger (same as ChatBox)
  const logServerMessage = useCallback((message: any, context?: string) => {
    const serverMessage: ServerMessage = {
      id: `server-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type: context || 'unknown',
      event: message?.type || message?.event || 'unknown',
      data: message,
      raw: message
    };

    setServerMessages(prev => [...prev, serverMessage]);

    const logStyle = {
      timestamp: new Date().toISOString(),
      context: context || 'SERVER_MESSAGE',
      event: message?.type || message?.event || 'unknown',
      message: message
    };

    console.group(`📝 FORMAREA ${logStyle.context} - ${logStyle.event}`);
    console.log(`⏰ Timestamp: ${logStyle.timestamp}`);
    console.log(`📝 Event Type: ${logStyle.event}`);
    console.log(`📦 Full Message:`, message);
    console.groupEnd();
  }, []);

  // RTVI Event monitoring (same approach as ChatBox)
  useEffect(() => {
    const actualClient = pipecatClient.client;
    
    if (!actualClient || typeof actualClient.on !== 'function') {
      console.warn("❌ PipecatClient not available or doesn't have .on() method");
      return;
    }

    console.log("📝 FormArea: Setting up server message listeners...");

    // Handler for server messages - looking for quiz questions
    const handleServerMessage = (data: any) => {
      logServerMessage(data, "SERVER_MESSAGE_QUIZ");
      
      // Parse quiz question from server message
      if (data && data.type === 'quiz_question') {
        console.log("🎯 Quiz question detected:", data);
        
        const quizQuestion: QuizQuestion = {
          type: data.type,
          question_index: data.question_index,
          question_id: data.question_id,
          question_text: data.question_text,
          options: data.options || [],
          total_questions: data.total_questions
        };
        
        setCurrentQuestion(quizQuestion);
        setSelectedAnswer(""); // Reset selection for new question
        setHasQuizStarted(true);
        
        toast.success(`Question ${data.question_index + 1} of ${data.total_questions} received`);
      }
      
      // Handle other message types if needed
      if (data && data.type === 'quiz_complete') {
        console.log("🏁 Quiz completed:", data);
        setCurrentQuestion(null);
        toast.success("Quiz completed!");
      }
    };

    // Listen for server messages
    actualClient.on(RTVIEvent.ServerMessage, handleServerMessage);

    // Optional: Monitor other relevant events
    const eventsToMonitor = [
      RTVIEvent.Connected,
      RTVIEvent.Disconnected,
      RTVIEvent.BotReady,
      RTVIEvent.Error
    ];

    const eventHandlers: { [key: string]: (data: any) => void } = {};
    eventsToMonitor.forEach(eventType => {
      eventHandlers[eventType] = (data: any) => {
        logServerMessage(data, `RTVI_EVENT_${eventType}`);
      };
      actualClient.on(eventType, eventHandlers[eventType]);
    });

    console.log("✅ FormArea server message listeners set up");

    // Cleanup
    return () => {
      console.log("🧹 FormArea: Cleaning up event listeners...");
      if (typeof actualClient.off === 'function') {
        actualClient.off(RTVIEvent.ServerMessage, handleServerMessage);
        eventsToMonitor.forEach(eventType => {
          actualClient.off(eventType, eventHandlers[eventType]);
        });
      }
    };
  }, [pipecatClient.client, logServerMessage]);

  // Auto-scroll to bottom when question changes
  useEffect(() => {
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

    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [currentQuestion]);

  const handleOptionSelect = (optionLabel: string) => {
    setSelectedAnswer(optionLabel);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) {
      toast.error("Please select an answer");
      return;
    }

    if (!isConnected || !isBotReady) {
      toast.error("Not connected to assistant");
      return;
    }

    setIsLoading(true);

    try {
      const selectedOption = currentQuestion.options.find(opt => opt.label === selectedAnswer);
      
      if (!selectedOption) {
        toast.error("Invalid option selected");
        return;
      }

      // Create answer record
      const userAnswer: UserAnswer = {
        question_id: currentQuestion.question_id,
        question_index: currentQuestion.question_index,
        selected_option: selectedOption,
        timestamp: new Date()
      };

      // Add to answers array
      setAnswers(prev => [...prev, userAnswer]);

      // Send answer back to server via appendToContext
      await appendToContext({
        role: 'user',
        content: `Quiz Answer - Question ${currentQuestion.question_index + 1}: ${selectedOption.label}) ${selectedOption.text} (Score: ${selectedOption.score})`,
        run_immediately: true
      });

      // Log the submission
      logServerMessage({
        type: 'quiz_answer_submitted',
        question_id: currentQuestion.question_id,
        question_index: currentQuestion.question_index,
        selected_option: selectedOption,
        timestamp: new Date().toISOString()
      }, 'USER_ANSWER');

      console.log("📤 Quiz answer submitted:", userAnswer);
      toast.success("Answer submitted successfully!");

      // Clear current question to wait for next one
      setCurrentQuestion(null);
      setSelectedAnswer("");

    } catch (error: any) {
      console.error("Failed to submit answer:", error);
      toast.error("Failed to submit answer. Please try again.");
      logServerMessage({ error, context: 'answer_submission_failed' }, 'ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestQuestion = async () => {
    if (!isConnected || !isBotReady) {
      toast.error("Not connected to assistant");
      return;
    }

    try {
      await appendToContext({
        role: 'user',
        content: "Please send me a quiz question",
        run_immediately: true
      });
      
      toast.success("Requested quiz question from assistant");
    } catch (error: any) {
      toast.error("Failed to request question");
    }
  };

  const getProgressPercentage = () => {
    if (!currentQuestion) return 0;
    return ((currentQuestion.question_index + 1) / currentQuestion.total_questions) * 100;
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <LayoutList className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Quiz Form Area
              {isUserSpeaking && <Mic className="w-4 h-4 text-green-600 animate-pulse" />}
              {isBotSpeaking && <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />}
            </CardTitle>
            <CardDescription>
              {currentQuestion 
                ? `Question ${currentQuestion.question_index + 1} of ${currentQuestion.total_questions}`
                : hasQuizStarted 
                  ? "Waiting for next question..."
                  : "Ready to receive quiz questions"
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {answers.length} answered
            </div>
            {isConnected && isBotReady ? (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Waiting
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {currentQuestion && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(getProgressPercentage())}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="w-full" />
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
          <div className="py-6">
            {/* No Question State */}
            {!currentQuestion && !hasQuizStarted && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HelpCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready for Quiz Questions</h3>
                <p className="text-muted-foreground mb-6">
                  Connect to the voice assistant and request a quiz to get started
                </p>
                {isConnected && isBotReady && (
                  <Button onClick={handleRequestQuestion}>
                    <Send className="w-4 h-4 mr-2" />
                    Request Quiz Question
                  </Button>
                )}
              </div>
            )}

            {/* Waiting for Next Question */}
            {!currentQuestion && hasQuizStarted && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Waiting for Next Question</h3>
                <p className="text-muted-foreground">
                  The assistant is preparing your next quiz question...
                </p>
              </div>
            )}

            {/* Current Question Display */}
            {currentQuestion && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                      {currentQuestion.question_index + 1}
                    </div>
                    <div className="flex-1">
                      <Label className="text-lg font-semibold leading-relaxed">
                        {currentQuestion.question_text}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Question ID: {currentQuestion.question_id}
                      </p>
                    </div>
                  </div>

                  <div className="ml-11">
                    <RadioGroup
                      value={selectedAnswer}
                      onValueChange={handleOptionSelect}
                      className="space-y-3"
                      disabled={isLoading}
                    >
                      {currentQuestion.options.map((option) => (
                        <div key={option.label} className="flex items-center space-x-3">
                          <RadioGroupItem 
                            value={option.label} 
                            id={`${currentQuestion.question_id}-${option.label}`} 
                          />
                          <Label
                            htmlFor={`${currentQuestion.question_id}-${option.label}`}
                            className={`flex-1 py-4 px-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 text-base ${
                              selectedAnswer === option.label 
                                ? 'bg-primary/10 border-primary' 
                                : ''
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span>
                                <strong>{option.label})</strong> {option.text}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {option.score} pts
                              </Badge>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {/* Previous Answers Summary */}
            {answers.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Previous Answers ({answers.length})
                </h4>
                <div className="space-y-2">
                  {answers.slice(-3).map((answer) => (
                    <div key={answer.question_id} className="text-xs bg-muted/30 p-2 rounded">
                      <span className="font-medium">Q{answer.question_index + 1}:</span> {answer.selected_option.label}) {answer.selected_option.text} 
                      <span className="text-muted-foreground ml-2">
                        ({answer.selected_option.score} pts at {formatTimestamp(answer.timestamp)})
                      </span>
                    </div>
                  ))}
                  {answers.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ... and {answers.length - 3} more answers
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Submit Button */}
        {currentQuestion && (
          <div className="border-t bg-card p-6 space-y-4 flex-shrink-0">
            <Button
              onClick={handleSubmitAnswer}
              className="w-full"
              disabled={!selectedAnswer || isLoading || !isConnected || !isBotReady}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Answer
                </>
              )}
            </Button>
            
            {isConnected && isBotReady && (
              <p className="text-xs text-muted-foreground text-center">
                Your answer will be sent to the voice assistant
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}