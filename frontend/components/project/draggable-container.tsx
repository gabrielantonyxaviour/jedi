"use client";

import { useState, useRef, useEffect } from "react";
import { useDrag, useDragDropManager } from "react-dnd";
import { X, Maximize2, Minimize2, Move } from "lucide-react";

interface DraggableContainerProps {
  id: string;
  children: React.ReactNode;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  userSide: "light" | "dark" | null;
  onClose: () => void;
}

export default function DraggableContainer({
  id,
  children,
  position,
  userSide,
  onClose,
}: DraggableContainerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragDropManager = useDragDropManager();

  const [{ isDragPreview }, drag, preview] = useDrag({
    type: "container",
    item: { id },
    collect: (monitor) => ({
      isDragPreview: monitor.isDragging(),
    }),
  });

  // Handle manual dragging (when not using react-dnd)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const workspaceRect = document
      .getElementById("workspace")
      ?.getBoundingClientRect();
    if (!workspaceRect) return;

    const newX = e.clientX - workspaceRect.left - dragOffset.x;
    const newY = e.clientY - workspaceRect.top - dragOffset.y;

    containerRef.current.style.left = `${Math.max(0, newX)}px`;
    containerRef.current.style.top = `${Math.max(0, newY)}px`;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Handle resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const newHeight = e.clientY - rect.top;

    containerRef.current.style.width = `${Math.max(300, newWidth)}px`;
    containerRef.current.style.height = `${Math.max(200, newHeight)}px`;
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMouseMove);
      document.addEventListener("mouseup", handleResizeMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleResizeMouseMove);
        document.removeEventListener("mouseup", handleResizeMouseUp);
      };
    }
  }, [isResizing]);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const containerStyle = isMaximized
    ? {
        position: "absolute" as const,
        top: "0px",
        left: "0px",
        width: "100%",
        height: "100%",
        zIndex: 50,
      }
    : {
        position: "absolute" as const,
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 10,
      };

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        drag(node);
      }}
      style={containerStyle}
      className={`bg-stone-900/85 backdrop-blur-sm border rounded-lg shadow-2xl transition-all duration-200 ${
        isDragPreview ? "opacity-60" : "opacity-100"
      } ${
        userSide === "light"
          ? "border-blue-600/30 shadow-blue-900/20"
          : userSide === "dark"
          ? "border-red-600/30 shadow-red-900/20"
          : "border-stone-600/30"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b cursor-move ${
          userSide === "light"
            ? "border-blue-600/20 bg-blue-900/10"
            : userSide === "dark"
            ? "border-red-600/20 bg-red-900/10"
            : "border-stone-600/20 bg-stone-800/20"
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2">
          <Move className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-medium text-stone-300 capitalize">
            {id.replace("-", " ")} Agent
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={toggleMaximize}
            className="p-1 hover:bg-stone-700 rounded transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4 text-stone-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-stone-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-600 rounded transition-colors"
          >
            <X className="w-4 h-4 text-stone-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Resize Handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-stone-500 rounded-sm opacity-50" />
        </div>
      )}
    </div>
  );
}
