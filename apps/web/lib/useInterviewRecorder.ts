'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInterviewRecorderOptions {
  stream: MediaStream | null;
  sessionId: string;
  onChunkReady?: (chunk: Blob) => void;
}

export function useInterviewRecorder({
  stream,
  onChunkReady
}: UseInterviewRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref for onChunkReady to avoid re-binding
  const onChunkReadyRef = useRef(onChunkReady);
  useEffect(() => {
    onChunkReadyRef.current = onChunkReady;
  }, [onChunkReady]);

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  const start = useCallback(() => {
    if (!stream) {
      console.error('Cannot start recording: No media stream provided');
      return;
    }

    if (isRecording) {
      console.warn('Already recording');
      return;
    }

    recordedChunksRef.current = [];
    const mimeType = getSupportedMimeType();
    
    try {
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          if (onChunkReadyRef.current) {
            onChunkReadyRef.current(event.data);
          }
        }
      };

      // Request data every 10 seconds
      mediaRecorder.start(10000);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      
    } catch (e) {
      console.error('Error starting MediaRecorder:', e);
    }
  }, [stream, isRecording]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, []);

  const getFullRecording = useCallback(() => {
    if (recordedChunksRef.current.length === 0) return null;
    const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
    return new Blob(recordedChunksRef.current, { type: mimeType });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return { isRecording, duration, start, stop, getFullRecording };
}
