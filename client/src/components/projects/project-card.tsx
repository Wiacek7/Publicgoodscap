import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { FaTwitter, FaDiscord, FaGithub, FaTelegram, FaGlobe, FaComment, FaRetweet } from "react-icons/fa";
import { BiUpvote } from "react-icons/bi";
import { FaFireFlameSimple } from "react-icons/fa6";
import { BiTrendingUp } from "react-icons/bi";
import { TbCheck } from "react-icons/tb";
import { LuClock } from "react-icons/lu";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CommentComposer } from "./comments/CommentComposer";
import { CommentThread } from "./comments/CommentThread";

interface Comment {
  id: number;
  content: string;
  projectId: number;
  userId: number;
  createdAt: string;
  parentId: number;
  threadId: number;
  depth: number;
  replyCount: number;
  upvotes: number;
  mentions: string[] | null;
  updatedAt: string;
  user?: {
    address: string;
    avatar: string;
  };
  hasLiked?: boolean;
}

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const [, setLocation] = useLocation();
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [upvoteAnimation, setUpvoteAnimation] = useState(false);
  const [isUpvoting, setIsUpvoting] = useState(false);
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch recent comments for preview
  const { data: recentComments = [], isLoading: isLoadingComments } = useQuery<Comment[]>({
    queryKey: ['comments', project.id, 'recent'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project.id}/comments?limit=2`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: isPreviewOpen, // Only fetch when preview section is open
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string, parentId?: number }) => {
      const response = await fetch(`/api/projects/${project.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId, userId: address })
      });
      if (!response.ok) throw new Error('Failed to create comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', project.id] });
      setIsPreviewOpen(false);
      toast({
        description: "Comment posted successfully!",
        duration: 2000,
      });
    }
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address })
      });
      if (!response.ok) throw new Error('Failed to like comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', project.id] });
    }
  });

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error('Please connect your wallet to upvote');
      }
      const response = await fetch(`/api/projects/${project.id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address })
      });
      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'ALREADY_UPVOTED') {
          throw new Error('You have already upvoted this project');
        }
        throw new Error('Failed to upvote project');
      }
      return response.json();
    },
    onMutate: () => {
      setIsUpvoting(true);
    },
    onSuccess: () => {
      // Optimistically update the UI
      setUpvoteAnimation(true);
      setTimeout(() => setUpvoteAnimation(false), 500);
      
      // Show success toast
      toast({
        description: "Project upvoted successfully!",
        duration: 2000,
      });

      // Invalidate project data to refresh points count
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: Error) => {
      // Show error toast
      toast({
        variant: "destructive",
        description: error.message,
        duration: 3000,
      });
    },
    onSettled: () => {
      setIsUpvoting(false);
    }
  });

  // Click on post content should navigate to detail view
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't navigate if clicking on an interactive element
    if (
      target.closest('.interaction-section') || 
      target.closest(`#comments-section-${project.id}`) ||
      target.closest('a') || 
      target.closest('button')
    ) {
      return;
    }
    setLocation(`/project/${project.id}`);
  };

  // Click on comment icon shows reply composer
  const handleCommentIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!address) {
      toast({
        variant: "destructive", 
        description: "Please connect your wallet to comment",
        duration: 3000,
      });
      return;
    }
    setShowCommentComposer(true);
  };

  const handleInteractionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPreviewOpen(!isPreviewOpen);
  };

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!address) {
      toast({
        variant: "destructive",
        description: "Please connect your wallet to upvote",
        duration: 3000,
      });
      return;
    }
    await upvoteMutation.mutateAsync();
  };

  const progressPercentage = project.fundingProgress || 0;

  let StatusIcon = null;
  let statusText = '';
  let statusColor = '';

  if (project.isHot) {
    StatusIcon = FaFireFlameSimple;
    statusText = 'Hot Project';
    statusColor = 'text-success';
  } else if (project.isTrending) {
    StatusIcon = BiTrendingUp;
    statusText = 'Trending';
    statusColor = 'text-warning';
  } else if (project.inFundingRound && progressPercentage === 100) {
    StatusIcon = TbCheck;
    statusText = 'Funded';
    statusColor = 'text-darkText';
  } else if (!project.inFundingRound) {
    StatusIcon = LuClock;
    statusText = 'New';
    statusColor = 'text-darkText';
  }

  let progressColorClasses = 'bg-primary';
  if (progressPercentage === 100) {
    progressColorClasses = 'bg-success';
  } else if (project.category === 'defi') {
    progressColorClasses = 'bg-gradient-to-r from-primary to-secondary';
  } else if (project.category === 'nft') {
    progressColorClasses = 'bg-gradient-to-r from-accent to-secondary';
  } else if (project.category === 'public_goods') {
    progressColorClasses = 'bg-gradient-to-r from-success to-primary';
  } else if (project.category === 'social') {
    progressColorClasses = 'bg-gradient-to-r from-accent to-primary';
  }

  const categoryMap: Record<string, string> = {
    'defi': 'badge-defi',
    'nft': 'badge-nft',
    'dao': 'badge-dao',
    'infrastructure': '',
    'public_goods': '',
    'social': ''
  };

  const categoryClass = categoryMap[project.category] || '';

  const getCategoryName = (category: string) => {
    if (category === 'public_goods') return 'Public Goods';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const socialIcons = [];
  if (project.twitter) {
    socialIcons.push(
      <a key="twitter" href={project.twitter} className="social-icon text-darkText hover:text-primary" aria-label="Twitter" target="_blank" rel="noopener noreferrer" onClick={handleInteractionClick}>
        <FaTwitter className="h-4 w-4" />
      </a>
    );
  }

  if (project.discord) {
    socialIcons.push(
      <a key="discord" href={project.discord} className="social-icon text-darkText hover:text-primary" aria-label="Discord" target="_blank" rel="noopener noreferrer" onClick={handleInteractionClick}>
        <FaDiscord className="h-4 w-4" />
      </a>
    );
  }
  if (project.telegram) {
    socialIcons.push(
      <a key="telegram" href={project.telegram} className="social-icon text-darkText hover:text-primary" aria-label="Telegram" target="_blank" rel="noopener noreferrer" onClick={handleInteractionClick}>
        <FaTelegram className="h-4 w-4" />
      </a>
    );
  }

  if (project.github) {
    socialIcons.push(
      <a key="github" href={project.github} className="social-icon text-darkText hover:text-primary" aria-label="GitHub" target="_blank" rel="noopener noreferrer" onClick={handleInteractionClick}>
        <FaGithub className="h-4 w-4" />
      </a>
    );
  }

  if (project.website) {
    socialIcons.push(
      <a key="website" href={project.website} className="social-icon text-darkText hover:text-primary" aria-label="Website" target="_blank" rel="noopener noreferrer" onClick={handleInteractionClick}>
        <FaGlobe className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div 
      data-project-id={project.id}
      onClick={handleCardClick} 
      className="project-card bg-darkCard rounded-xl overflow-hidden border border-darkBorder shadow-card cursor-pointer hover:border-primary"
    >
      <div className="p-4 flex items-start gap-3">
        <img 
          src={project.logo} 
          alt={`${project.name} logo`} 
          className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" 
        />
        
        <div className="overflow-hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-white truncate">{project.name}</h3>
            <span className={`badge ${categoryClass} text-xs`}>{getCategoryName(project.category)}</span>
          </div>
          <p className="text-darkText text-sm line-clamp-2">
            {project.description}
          </p>
        </div>
      </div>
      
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-darkText">
            {project.inFundingRound 
              ? `Round: ${progressPercentage === 100 ? 'Closed' : 'Open'} ${progressPercentage < 100 ? `(${progressPercentage}% funded)` : ''}`
              : 'Round: Closed'
            }
          </span>
          
          {StatusIcon && (
            <span className={`text-sm font-medium ${statusColor} flex items-center gap-1`}>
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{statusText}</span>
            </span>
          )}
        </div>
        <div className="progress-bar mb-3">
          <div 
            className={`progress-fill ${progressColorClasses}`} 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">
            <span className="text-darkText">Total Raised</span>
            <div className="font-medium text-white">{formatCurrency(project.totalFunding)}</div>
          </div>
          <div className="text-sm">
            <span className="text-darkText">Funding Sources</span>
            <div className="font-medium text-white">
              {project.fundingSources?.length ? project.fundingSources.join(', ') : 'None'}
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-3 border-t border-darkBorder bg-darkCard bg-opacity-50 flex items-center justify-between interaction-section" onClick={handleInteractionClick}>
        <div className="flex items-center gap-2">
          <button 
            className={`flex items-center gap-1.5 transition-colors ${isPreviewOpen ? 'text-primary' : 'text-darkText hover:text-white'}`}
            onClick={handleCommentClick}
          >
            <FaComment className="h-3.5 w-3.5" />
            <span className="text-sm">{project.commentCount || 0}</span>
          </button>
          <button 
            className={`flex items-center gap-1.5 transition-colors group
              ${project.hasUpvoted ? 'text-primary' : 'text-darkText hover:text-white'}`}
            onClick={handleUpvote}
          >
            <BiUpvote 
              className={`h-3.5 w-3.5 transition-all duration-200 ease-out
                ${project.hasUpvoted ? 'text-primary scale-110' : 'group-hover:-translate-y-0.5'}
                ${upvoteAnimation ? 'animate-bounce-short' : ''}`}
            />
            <span className="text-sm">{project.pointsCount}</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex space-x-1.5">
            {socialIcons}
          </div>
          <Button 
            size="sm"
            className={`fund-button ${
              project.inFundingRound && progressPercentage < 100
                ? 'bg-primary hover:bg-opacity-90'
                : 'bg-darkCard hover:bg-opacity-90'
            } text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors h-7`}
            asChild
            onClick={handleInteractionClick}
          >
            <a 
              href={project.fundingRoundLink || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {project.inFundingRound && progressPercentage < 100 ? 'Fund' : 'Donate'}
            </a>
          </Button>
        </div>
      </div>

      {isPreviewOpen && (
        <div className="border-t border-darkBorder">
          {address ? (
            <div className="flex gap-3 p-4">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`}
                alt="Your avatar"
                className="w-8 h-8 rounded-full"
              />
              <Button
                variant="ghost"
                className="flex-1 h-auto py-2 px-3 justify-start text-sm text-darkText hover:text-white text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCommentComposer(true);
                }}
              >
                Write a comment...
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-darkText text-sm">
              Connect your wallet to join the discussion
            </div>
          )}

          {recentComments.map((comment) => (
            <CommentThread
              key={comment.id}
              projectId={project.id}
              comment={comment}
            />
          ))}

          {project.commentCount > 2 && (
            <div className="text-center py-4">
              <Button
                variant="link"
                className="text-primary hover:text-primary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/project/${project.id}?tab=discussion`);
                }}
              >
                View all {project.commentCount} comments
              </Button>
            </div>
          )}
        </div>
      )}

      <CommentComposer
        isOpen={showCommentComposer}
        onClose={() => setShowCommentComposer(false)}
        projectId={project.id}
        onSuccess={() => {
          setShowCommentComposer(false);
          setIsPreviewOpen(true);
        }}
      />
    </div>
  );
}
