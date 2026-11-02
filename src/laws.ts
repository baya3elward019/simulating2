// The mathematical laws behind every simulator. One source of truth for the website
// ("Laws & formulas" panels) and the Excel workbooks ("Laws / القوانين" section).

export type Law = {name: [string, string]; math: string; excel?: string; meaning: [string, string]};
export type LawTopic = 'coin' | 'dice' | 'queue' | 'two' | 'mm1' | 'birthday';

const queueCore: Law[] = [
  {name: ['Random-number mapping (inverse transform)', 'تحويل العدد العشوائي (التحويل العكسي)'], math: 'U ~ Uniform[0,1);  X = xᵢ  if  CDMᵢ ≤ U < CDFᵢ', excel: 'VLOOKUP(RAND(), CDM:Time, 2, TRUE)',
    meaning: ['Each value owns an interval of [0,1) whose width equals its probability, so it is sampled with exactly that probability.', 'كل قيمة تأخذ فترة من [0,1) طولها يساوي احتمالها، فتظهر القيمة بنفس احتمالها بالضبط.']},
  {name: ['Cumulative bounds', 'الحدود التراكمية'], math: 'CDM₁ = 0,  CDMᵢ = CDFᵢ₋₁,  CDFᵢ = CDMᵢ + pᵢ,  Σ pᵢ = 1', excel: 'CDM = previous CDF;  CDF = ROUND(CDM + P, 12)',
    meaning: ['CDM is the lower bound and CDF the upper bound of each random-number interval; probabilities must add up to 1.', 'CDM هو الحد الأدنى وCDF الحد الأعلى لفترة العدد العشوائي، ومجموع الاحتمالات يجب أن يساوي 1.']},
  {name: ['Arrival time', 'زمن الوصول'], math: 'ATᵢ = ATᵢ₋₁ + IATᵢ,  AT₀ = 0', excel: 'D(i) = D(i−1) + C(i)',
    meaning: ['Each customer arrives one interarrival time after the previous customer.', 'كل عميل يصل بعد العميل السابق بمقدار زمن ما بين الوصولين.']},
  {name: ['Service start (FCFS)', 'بداية الخدمة (الأسبق أولاً)'], math: 'SSᵢ = max(ATᵢ, ESₛₑᵣᵥₑᵣ of previous customer)', excel: 'MAX(D, previous ES of the chosen server)',
    meaning: ['Service starts when both the customer has arrived and the server is free.', 'تبدأ الخدمة عندما يكون العميل قد وصل والخادم قد تفرغ معاً.']},
  {name: ['Service end', 'نهاية الخدمة'], math: 'ESᵢ = SSᵢ + STᵢ', excel: 'H + G',
    meaning: ['The service ends after the sampled service time.', 'تنتهي الخدمة بعد مدة الخدمة المولدة.']},
  {name: ['Time in queue / in system', 'زمن الانتظار / زمن النظام'], math: 'Wqᵢ = SSᵢ − ATᵢ ;  Wᵢ = ESᵢ − ATᵢ', excel: 'H − D ;  I − D',
    meaning: ['Waiting is the gap between arrival and service start; system time adds the service itself.', 'الانتظار هو الفرق بين الوصول وبداية الخدمة، وزمن النظام يضيف مدة الخدمة نفسها.']},
  {name: ['Server idle time', 'زمن خمول الخادم'], math: 'Idleᵢ = max(0, SSᵢ − previous ES)', excel: 'MAX(0, H − previous ES)',
    meaning: ['The server is idle while it waits for the next customer to arrive.', 'يكون الخادم خاملاً أثناء انتظاره وصول العميل التالي.']},
  {name: ['Performance measures', 'مقاييس الأداء'], math: 'W̄q = ΣWq / n ;  P(wait) = #(Wq>0) / n ;  idle ratio = ΣIdle / (servers·T) ;  utilization = 1 − idle ratio', excel: 'AVERAGE(J) ; COUNTIF(J,">0")/COUNT(A) ; U15/(U14·servers) ; 1 − U16',
    meaning: ['T is the horizon (last service end). The professor’s “server effectiveness” is the idle ratio; utilization is its complement.', 'T هو أفق المحاكاة (آخر نهاية خدمة). “فعالية الخادم” عند الأستاذ هي نسبة الخمول، والاستغلال هو مكملها.']},
  {name: ['Little’s law (time averages)', 'قانون ليتل (المتوسطات الزمنية)'], math: 'L = ΣWᵢ / T ;  Lq = ΣWqᵢ / T', excel: 'SUM(K)/U14 ; SUM(J)/U14',
    meaning: ['Average number in system/queue equals total customer-time divided by the horizon.', 'متوسط عدد العملاء في النظام/الطابور يساوي مجموع أزمنة العملاء مقسوماً على أفق المحاكاة.']},
];

export const LAWS: Record<LawTopic, Law[]> = {
  coin: [
    {name: ['Uniform random number', 'العدد العشوائي المنتظم'], math: 'U ~ Uniform[0,1)', excel: 'RAND()', meaning: ['Every value between 0 and 1 is equally likely.', 'كل قيمة بين 0 و1 لها نفس الفرصة.']},
    {name: ['Coin rule', 'قاعدة العملة'], math: 'Heads if U < 0.5, otherwise Tails  ⇒  P(H) = P(T) = 0.5', excel: 'IF(B4<0.5,"Heads","Tails")', meaning: ['Half of the interval [0,1) is assigned to each face.', 'نصف الفترة [0,1) لكل وجه، فاحتمال كل وجه 0.5.']},
    {name: ['Law of large numbers', 'قانون الأعداد الكبيرة'], math: 'p̂ = (number of heads) / (number of tosses) → 0.5', meaning: ['The observed proportion approaches the true probability as the number of tosses grows.', 'النسبة المشاهدة تقترب من الاحتمال الحقيقي كلما زاد عدد الرميات.']},
  ],
  dice: [
    {name: ['Discrete uniform die', 'النرد المنتظم المنفصل'], math: 'X ∈ {1,…,6},  P(X = k) = 1/6', excel: 'RANDBETWEEN(1,6)', meaning: ['Each face has the same probability 1/6 ≈ 0.1667.', 'لكل وجه نفس الاحتمال 1/6 ≈ 0.1667.']},
    {name: ['Same thing from RAND', 'نفس الشيء من RAND'], math: 'X = ⌊6U⌋ + 1', excel: 'INT(6*RAND())+1', meaning: ['Split [0,1) into six equal parts; the part that contains U is the face.', 'نقسم [0,1) إلى ستة أجزاء متساوية؛ الجزء الذي يقع فيه U هو الوجه.']},
    {name: ['Expected value', 'القيمة المتوقعة'], math: 'E[X] = (1+2+…+6)/6 = 3.5 ;  Var(X) = 35/12 ≈ 2.9167', meaning: ['The long-run average of many rolls is 3.5.', 'متوسط عدد كبير من الرميات يقترب من 3.5.']},
  ],
  queue: queueCore,
  two: [
    ...queueCore.slice(0, 3),
    {name: ['Server choice (shared queue)', 'اختيار الخادم (طابور مشترك)'], math: 'A if A free at ATᵢ; else B if B free; else the earliest to finish (A wins ties)', excel: 'IF(M<=D,1,IF(N<=D,2,IF(M<=N,1,2)))',
      meaning: ['An idle server is used first; otherwise the customer waits for whichever server finishes first.', 'يُستخدم الخادم المتاح أولاً، وإلا ينتظر العميل الخادم الذي ينتهي أولاً.']},
    ...queueCore.slice(3),
  ],
  mm1: [
    {name: ['Exponential sampling', 'توليد الأزمنة الأسية'], math: 'IAT = −ln(1−U)/λ ;  ST = −ln(1−U)/μ', excel: '-LN(1-RAND())/$U$5 ; -LN(1-RAND())/$U$6', meaning: ['Inverse transform of the exponential distribution with rate λ (arrivals) or μ (service).', 'التحويل العكسي للتوزيع الأسي بمعدل λ للوصول أو μ للخدمة.']},
    ...queueCore.slice(2),
    {name: ['M/M/1 steady state (λ < μ)', 'الحالة المستقرة لـ M/M/1 (λ < μ)'], math: 'ρ = λ/μ ; L = λ/(μ−λ) ; Lq = λ²/(μ(μ−λ)) ; W = 1/(μ−λ) ; Wq = λ/(μ(μ−λ))', excel: '$U$5/$U$6 ; $U$5/($U$6-$U$5) ; …',
      meaning: ['Theoretical long-run values; a finite simulation only approaches them.', 'قيم نظرية على المدى الطويل؛ المحاكاة المحدودة تقترب منها فقط.']},
  ],
  birthday: [
    {name: ['Complement rule', 'قاعدة المتممة'], math: 'P(at least one shared) = 1 − P(all different)', excel: '=1 - Q', meaning: ['It is easier to count the case in which nobody matches and subtract it from 1.', 'الأسهل أن نحسب حالة عدم وجود أي تطابق ونطرحها من 1.']},
    {name: ['All different (exact)', 'الجميع مختلفون (الصيغة الدقيقة)'], math: 'Q(n) = (N/N)·((N−1)/N)·…·((N−n+1)/N) = N! / ((N−n)!·Nⁿ)', excel: 'Q(k) = Q(k−1)*(N−k+1)/N   or   EXP(GAMMALN(N+1)-GAMMALN(N-n+1)-n*LN(N))',
      meaning: ['Person k must avoid the k−1 days already taken, which happens with probability (N−k+1)/N.', 'الشخص رقم k يجب أن يتجنب k−1 يوماً محجوزاً، واحتمال ذلك (N−k+1)/N.']},
    {name: ['Exact collision probability', 'احتمال التصادم الدقيق'], math: 'p(n) = 1 − ∏ₖ₌₀ⁿ⁻¹ (N−k)/N', excel: '1-EXP(GAMMALN(N+1)-GAMMALN(N-n+1)-n*LN(N))', meaning: ['For N = 365: p(10) = 0.1169, p(23) = 0.5073, p(50) = 0.9704.', 'عند N = 365: p(10) = 0.1169 و p(23) = 0.5073 و p(50) = 0.9704.']},
    {name: ['Number of pairs', 'عدد الأزواج'], math: 'C(n,2) = n(n−1)/2', excel: 'n*(n-1)/2', meaning: ['Every pair is a chance to match: 23 people form 253 pairs. This is why the result beats intuition.', 'كل زوج فرصة للتطابق: 23 شخصاً يكوّنون 253 زوجاً، ولهذا تخالف النتيجة الحدس.']},
    {name: ['Exponential approximation', 'التقريب الأسي'], math: '1 − x ≈ e^(−x)  ⇒  p(n) ≈ 1 − e^(−n(n−1)/(2N))', excel: '1-EXP(-n*(n-1)/(2*N))', meaning: ['Valid when n is small relative to N; for N = 365, n = 23 it gives 0.5000 versus the exact 0.5073.', 'دقيق عندما تكون n صغيرة مقارنة بـ N؛ عند N = 365 و n = 23 يعطي 0.5000 مقابل 0.5073 بالضبط.']},
    {name: ['50% threshold (square-root rule)', 'عتبة 50% (قاعدة الجذر التربيعي)'], math: 'n(n−1)/(2N) = ln 2  ⇒  n ≈ √(2N·ln 2) ≈ 1.1774·√N', excel: 'SQRT(2*N*LN(2))', meaning: ['N = 365 → n ≈ 22.49 → 23 people. N = 65,536 → n ≈ 301.4 sessions. Collisions appear after about √N draws: O(√N).', 'N = 365 ← n ≈ 22.49 أي 23 شخصاً. N = 65,536 ← n ≈ 301.4 جلسة. التصادم يظهر بعد حوالي √N محاولة: O(√N).']},
    {name: ['Hash functions (b-bit output)', 'دوال التجزئة (ناتج b بت)'], math: 'N = 2ᵇ ⇒ collision ≈ 1.1774·2^(b/2) hashes ;  preimage ≈ 2ᵇ attempts', excel: 'SQRT(2*2^b*LN(2))', meaning: ['A collision attack only needs about the square root of the output space; security level is b/2 bits.', 'هجوم التصادم يحتاج تقريباً الجذر التربيعي لفضاء النواتج فقط؛ مستوى الأمان b/2 بت.']},
    {name: ['Monte Carlo estimate', 'تقدير مونت كارلو'], math: 'p̂ = hits / T ;  SE = √(p(1−p)/T) ;  95% margin ≈ 1.96·SE', excel: 'AVERAGE(match column) ; 1.96*SQRT(p*(1-p)/T)', meaning: ['The simulated rate differs from the exact value by random sampling error that shrinks like 1/√T: 100× more trials → 10× smaller error.', 'النسبة المحاكاة تختلف عن القيمة الدقيقة بخطأ عيّنة عشوائي يصغر بمعدل 1/√T: زيادة التجارب 100 مرة تقلل الخطأ 10 مرات.']},
  ],
};
