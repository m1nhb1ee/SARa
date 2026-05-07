import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertTriangle, LogOut, Maximize2, Send, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
import { apiClient } from '@/api/client';
import { VolumeSliceViewer } from '@/app/components/shared/VolumeSliceViewer';
import { STEPS } from '@/constants/training';
import styles from '@/styles/DiagnosisSession.module.css';

type MobileTab = 'image' | 'chat';

export function SwapSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<MobileTab>('image');
  const [pendingUserMessage, setPendingUserMessage] = useState('');
  const [streamingDoctorText, setStreamingDoctorText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSession = async () => {
    if (!sessionId) return;
    setLoading(true);
    const res = await apiClient.getSwapSession(sessionId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSession(res.data);
  };

  useEffect(() => { loadSession(); }, [sessionId]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, streamingDoctorText, pendingUserMessage]);

  const sendMessage = async () => {
    const message = input.trim();
    if (!sessionId || !message || sending || session?.status === 'COMPLETED') return;

    setInput('');
    setError(null);
    setSending(true);
    setActiveTab('chat');
    setPendingUserMessage(message);
    setStreamingDoctorText('');

    const res = await apiClient.streamSwapMessage(sessionId, message, (delta) => {
      setStreamingDoctorText(prev => prev + delta);
    });

    setSending(false);
    setPendingUserMessage('');
    setStreamingDoctorText('');

    if (res.error) {
      setError(res.error);
      setInput(message);
      return;
    }
    setSession(res.data);
  };

  if (loading) {
    return (
      <div className={styles.session}>
        <div className="flex items-center justify-center h-full">Preparing debate...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.session}>
        <div className="flex items-center justify-center h-full" style={{ color: '#A93226' }}>
          {error || 'Swap session not found'}
        </div>
      </div>
    );
  }

  const caseData = session.case ?? {};
  const currentStep = session.current_step ?? 0;
  const stepName = STEPS[currentStep] ?? 'OBSERVE';
  const isComplete = session.status === 'COMPLETED';
  const scorePct = session.final_score != null ? Math.round(session.final_score * 100) : null;

  return (
    <div className={styles.session}>
      <div className={styles.topBar}>
        <span className={styles.caseTitle}>{caseData.title}</span>
        <span className={styles.badge}>{caseData.modality}</span>
        <span className={styles.badge}>Swap Debate</span>
        <div className={styles.topBarSpacer} />
        <button onClick={() => navigate('/swap')} className={styles.exitBtn}>
          <LogOut size={14} />
          Thoát
        </button>
      </div>

      <div className={styles.mobileTabs}>
        {[
          { key: 'image', label: 'Hình ảnh' },
          { key: 'chat', label: 'Debate' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as MobileTab)}
            className={`${styles.mobileTab} ${activeTab === tab.key ? styles.mobileTabActive : styles.mobileTabInactive}`}
          >
            {activeTab === tab.key && <span className={styles.mobileTabIndicator} />}
            <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.mainContent}>
        <div className={`${styles.leftPanel} ${activeTab !== 'image' ? styles.leftPanelHidden : ''}`}>
          <div className={styles.pageCornerFold} />
          <div className={styles.caseStampRow}>
            <span className={styles.caseStampLabel}>
              Case #{String(caseData.id ?? '').slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className={styles.imageArea}>
            <div className={styles.imageMount}>
              <div className={styles.imageCornerTL} />
              <div className={styles.imageCornerTR} />
              <div className={styles.imageCornerBL} />
              <div className={styles.imageCornerBR} />
              {caseData.images?.length ? (
                <>
                  <VolumeSliceViewer
                    images={caseData.images}
                    zoom={zoom}
                    imgClassName={styles.medicalImage}
                  />
                  <div className={styles.zoomControls}>
                    {[
                      { icon: ZoomIn, action: () => setZoom(z => Math.min(z + 0.25, 3)) },
                      { icon: ZoomOut, action: () => setZoom(z => Math.max(z - 0.25, 0.5)) },
                      { icon: Maximize2, action: () => setZoom(1) },
                    ].map(({ icon: Icon, action }, i) => (
                      <button key={i} onClick={action} className={styles.zoomBtn}>
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.imagePlaceholder}>[ Đang tải hình ảnh... ]</p>
              )}
            </div>
          </div>

          <div className={styles.imageCaption}>
            <div className={styles.imageCaptionLabel}>Clinical History</div>
            <p className={styles.imageCaptionText}>
              {caseData.clinical_history || 'No clinical history provided.'}
            </p>
          </div>
        </div>

        <div className={`${styles.rightPanel} ${activeTab !== 'chat' ? styles.rightPanelHidden : ''}`}>
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.panelHeaderTitle}>Dr. Swap</span>
              <span className={styles.panelHeaderBadge}>GPT-4o</span>
            </div>
            {isComplete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7D9B76' }}>
                <Trophy size={15} />
                <span className={styles.panelHeaderBadge}>{scorePct}% persuaded</span>
              </div>
            )}
          </div>

          <div className={styles.stepper}>
            <div className={styles.stepperTrack}>
              {STEPS.map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={styles.stepItem}>
                    <div className={
                      i < currentStep || isComplete
                        ? styles.stepCircleDone
                        : i === currentStep
                          ? styles.stepCircleActive
                          : styles.stepCircleIdle
                    }>
                      {i < currentStep || isComplete ? '✓' : i + 1}
                    </div>
                    <span className={`${styles.stepLabel} ${i <= currentStep || isComplete ? styles.stepLabelActive : styles.stepLabelIdle}`}>
                      {step}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={i < currentStep || isComplete ? styles.stepConnectorDone : styles.stepConnectorIdle} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.stepChip}>
            <span className={styles.stepChipInner}>
              {isComplete ? 'Debate complete' : `Bước ${currentStep + 1} - ${stepName}`}
            </span>
          </div>

          <div className={styles.chatArea}>
            {session.messages?.map((message: any) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={isUser ? styles.studentMessageWrapper : styles.aiMessageWrapper}
                >
                  <div className={isUser ? styles.studentMessage : `${styles.aiMessage} ${message.metadata?.convinced ? styles.aiMessageCorrect : ''}`}>
                    {!isUser && (
                      <div className={styles.aiMessageHeader}>
                        <span className={styles.aiMessageAuthor}>Dr. Swap</span>
                        {message.metadata?.convinced && <span style={{ color: '#7D9B76', fontSize: 11 }}>✓</span>}
                      </div>
                    )}
                    <p className={isUser ? styles.studentMessageText : styles.aiMessageText}>
                      {message.content}
                    </p>
                    {message.metadata?.convinced && (
                      <div style={{ marginTop: 6, fontFamily: "'Courier Prime', monospace", fontSize: 10, color: '#7D9B76' }}>
                        CONVINCED / {Math.round((message.metadata.persuasion_score ?? 0) * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {pendingUserMessage && (
              <div className={styles.studentMessageWrapper}>
                <div className={styles.studentMessage}>
                  <p className={styles.studentMessageText}>{pendingUserMessage}</p>
                </div>
              </div>
            )}

            {streamingDoctorText && (
              <div className={styles.aiMessageWrapper}>
                <div className={styles.aiMessage}>
                  <div className={styles.aiMessageHeader}>
                    <span className={styles.aiMessageAuthor}>Dr. Swap</span>
                  </div>
                  <p className={styles.aiMessageText}>{streamingDoctorText}</p>
                </div>
              </div>
            )}

            {sending && !streamingDoctorText && (
              <div className={styles.typingWrapper}>
                <div className={styles.typingBubble}>
                  {[0, 1, 2].map(i => <div key={i} className={styles.typingDot} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className={styles.inputArea}>
            {error && (
              <div className={styles.shortAnswerError}>
                <AlertTriangle size={13} color="#A93226" />
                <span className={styles.shortAnswerErrorText}>{error}</span>
              </div>
            )}

            {isComplete ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {STEPS.map((step, i) => {
                  const score = session.scores?.find((s: any) => s.step_index === i);
                  return (
                    <div key={step} style={{ border: '1px solid var(--vj-sepia)', background: 'var(--vj-parchment)', padding: 8 }}>
                      <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: 'var(--vj-faded)' }}>{step}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: 'var(--vj-olive)' }}>
                        {Math.round((score?.persuasion_score ?? 0) * 100)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.inputRow}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Tranh luận với bác sĩ..."
                  rows={3}
                  className={styles.textarea}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className={styles.sendButton}
                >
                  <Send size={14} />
                  Send Debate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
