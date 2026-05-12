import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertTriangle, CheckCircle2, LogOut, Maximize2, Send, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [showCompletion, setShowCompletion] = useState(false);
  const completionShownRef = useRef(false);
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

  useEffect(() => {
    if (session?.status === 'COMPLETED' && !completionShownRef.current) {
      completionShownRef.current = true;
      setShowCompletion(true);
    }
  }, [session?.status]);

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
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--accent-clay)' }}>
          {error || 'Swap session not found'}
        </div>
      </div>
    );
  }

  const caseData = session.case ?? {};
  const currentStep = session.current_step ?? 0;
  const stepName = STEPS[currentStep] ?? 'DESCRIBE';
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-sage)' }}>
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
                        {message.metadata?.convinced && <span style={{ color: 'var(--accent-sage)', fontSize: 11 }}>✓</span>}
                      </div>
                    )}
                    <p className={isUser ? styles.studentMessageText : styles.aiMessageText}>
                      {message.content}
                    </p>
                    {message.metadata?.convinced && (
                      <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: 'var(--accent-sage)' }}>
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
                <AlertTriangle size={13} color="var(--accent-clay)" />
                <span className={styles.shortAnswerErrorText}>{error}</span>
              </div>
            )}

            {isComplete ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {STEPS.map((step, i) => {
                  const score = session.scores?.find((s: any) => s.step_index === i);
                  return (
                    <div key={step} style={{ border: '1px solid var(--vj-sepia)', background: 'var(--vj-parchment)', padding: 8 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: 'var(--vj-faded)' }}>{step}</div>
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

      {showCompletion && (
        <div className={styles.exitModalOverlay}>
          <div className={styles.exitModalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.exitModalHeader}>
              <div className={styles.exitModalHeaderRow}>
                <div className={styles.exitModalIcon} style={{ background: 'rgba(125,155,118,0.15)', border: '1px solid var(--accent-sage)' }}>
                  <CheckCircle2 size={20} color="var(--accent-sage)" />
                </div>
                <div>
                  <h3 className={styles.exitModalTitle}>Hoàn thành tranh luận!</h3>
                  <p className={styles.exitModalSubtitle}>{caseData?.title}</p>
                </div>
              </div>
            </div>

            <div className={styles.exitModalBody}>
              <div className={styles.exitModalNote} style={{ textAlign: 'center', padding: '20px 12px', transform: 'rotate(0deg)' }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--vj-faded)', marginBottom: 8 }}>
                  Mức độ thuyết phục
                </div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 48, fontWeight: 700, color: 'var(--vj-ink)', lineHeight: 1 }}>
                  {scorePct ?? '—'}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: 'var(--vj-faded)', marginTop: 4 }}>
                  / 100
                </div>
              </div>

              <div className={styles.exitModalInfo} style={{ marginTop: 14 }}>
                <div className={styles.exitModalInfoLabel}>Điểm theo bước</div>
                <div className={styles.exitModalInfoDetails}>
                  {STEPS.map((step, i) => {
                    const score = session.scores?.find((s: any) => s.step_index === i);
                    const pct = Math.round((score?.persuasion_score ?? 0) * 100);
                    return (
                      <span key={step} style={{ display: 'inline-block', marginRight: 8 }}>
                        <span style={{ color: 'var(--vj-terracotta)' }}>✓</span> {step} {pct}%{i < STEPS.length - 1 ? ' ·' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const dx = session.doctor_diagnosis ?? {};
                const conclusion = dx.CONCLUSION || dx.REASONING || dx.DESCRIBE;
                if (!conclusion) return null;
                return (
                  <div className={styles.exitModalInfo} style={{ marginTop: 14 }}>
                    <div className={styles.exitModalInfoLabel}>Tổng kết chẩn đoán</div>
                    <div className={styles.exitModalInfoDetails} style={{ whiteSpace: 'pre-wrap' }}>
                      {conclusion}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.exitModalFooter}>
              <button
                onClick={() => {
                  setShowCompletion(false);
                  setActiveTab('chat');
                }}
                className={styles.exitModalCancelBtn}
              >
                Xem lại cuộc trò chuyện
              </button>
              <button
                onClick={() => { setShowCompletion(false); navigate('/swap'); }}
                className={styles.exitModalConfirmBtn}
              >
                Thử case khác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
