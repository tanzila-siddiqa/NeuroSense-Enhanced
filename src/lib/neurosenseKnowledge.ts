export const NEUROSENSE_KNOWLEDGE = `
# NeuroSense

NeuroSense is a multimodal AI-based Parkinson's disease screening application.

NeuroSense is a screening tool and NOT a medical diagnostic system.

## What is Parkinson's disease?

Parkinson's disease is a neurological condition that can affect movement and other functions of the body.

Symptoms can vary from person to person. Movement-related changes may include tremor, changes in movement speed, stiffness, and changes in coordination. Speech and voice can also change in some people.

A screening system such as NeuroSense can look for patterns associated with Parkinson's disease, but it cannot determine whether a person has the disease.

## What is a screening estimate, exactly?

A screening estimate is a model-generated probability based on the information analyzed by NeuroSense.

NeuroSense analyzes drawing samples and a sustained voice recording. Its machine-learning models produce probabilities that are then combined using the application's fusion calculation.

The result is an estimate used for screening purposes.

It is NOT:
- A diagnosis
- A confirmation that someone has Parkinson's disease
- A confirmation that someone does not have Parkinson's disease
- An official measurement of disease severity
- A prediction of future disease progression

For example, an Elevated result means that the application's calculated screening probability falls into its Elevated application category. It does not mean that the person has Parkinson's disease.

## Why are drawing patterns studied?

Drawing patterns can provide information about how a person performs a controlled hand movement.

NeuroSense uses three drawing tasks:

1. Spiral
2. Circle
3. Meander

The user traces each pattern while following a faint guide.

The submitted drawing is analyzed by image-based machine-learning models. There are separate trained models for the Spiral, Circle, and Meander tasks.

These models produce Parkinson-related screening probabilities.

Drawing patterns are studied because changes in movement can sometimes be reflected in how a person performs a controlled drawing task.

However, no individual drawing pattern proves that someone has Parkinson's disease.

## Drawing Assessment

NeuroSense analyzes three drawing patterns:

- Spiral
- Circle
- Meander

Each drawing is analyzed by its corresponding trained image-based model.

The three drawing probabilities are combined to obtain the drawing-side probability.

The current drawing machine-learning models are image-based.

NeuroSense also records movement-related information during drawing, including:

- Path length
- Speed variability
- Average acceleration
- Acceleration variability
- Average jerk
- Maximum jerk
- Jerk variability
- Pause count
- Pause duration
- Straightness
- Movement irregularity

These measurements are displayed as assessment information.

The current drawing classifier does not use these live trajectory measurements as model features because the training images do not contain labeled x/y/time trajectory data.

Therefore, a particular value of jerk, acceleration, speed, pause count, or another movement measurement should not be interpreted as a medical threshold.

## What can voice changes mean?

Voice changes can occur for many different reasons.

Some people with Parkinson's disease may experience changes in speech or voice, such as changes in loudness, pitch, stability, or other acoustic characteristics.

NeuroSense analyzes acoustic information from a sustained voice recording.

The current voice feature set includes:

- MFCC statistics
- MFCC delta statistics
- MFCC second-delta statistics
- Pitch statistics
- Jitter
- Shimmer
- Harmonics-to-noise ratio
- Zero-crossing rate
- RMS energy
- Spectral centroid
- Spectral bandwidth
- Spectral rolloff
- Spectral flatness
- Duration

The current NeuroSense voice model is an SVM pipeline using an established 138-feature representation.

The voice model produces a Parkinson-related screening probability.

A single voice feature does not prove that someone has Parkinson's disease. Voice changes can have many possible causes.

## When should I talk to a doctor?

If you are concerned about symptoms such as persistent tremor, changes in movement, stiffness, balance problems, unusual changes in walking, or persistent changes in speech or voice, it is appropriate to discuss your concerns with a qualified healthcare professional.

You should also discuss a NeuroSense result with a healthcare professional if the result concerns you.

NeuroSense is designed for screening and education. It should not be used as a replacement for professional medical evaluation.

## How accurate is AI screening?

AI screening accuracy depends on the dataset, the people represented in the dataset, the features used, the model, the testing method, and the conditions under which the system is used.

A model can perform well on a particular test dataset but still make incorrect predictions when used with new people or different recording conditions.

NeuroSense's model probabilities should therefore be treated as screening estimates rather than diagnostic certainty.

The current NeuroSense models have been evaluated using project datasets, but their results should not be interpreted as clinical validation or as evidence that NeuroSense can diagnose Parkinson's disease.

## Assessment Flow

The NeuroSense guided assessment has four stages:

1. Drawing assessment
2. Voice assessment
3. Multimodal fusion
4. Result

A complete guided assessment requires both drawing and voice results.

## Voice Assessment

The user records a sustained voice sample.

NeuroSense extracts acoustic features from the recording.

The voice model produces a Parkinson-related probability.

The current voice model is an SVM pipeline using the established 138-feature representation.

## Multimodal Fusion

NeuroSense currently uses:

Drawing weight = 75%

Voice weight = 25%

The overall probability is calculated using:

Overall probability = (Drawing probability × 0.75) + (Voice probability × 0.25)

These weights are project-level heuristics and are NOT medically validated clinical weights.

## Risk Categories

The current application uses the following screening categories:

Low:
overall probability below 60%

Moderate:
overall probability from 60% to below 75%

Elevated:
overall probability of 75% or higher

These are application-level heuristics.

They are NOT:
- Clinical diagnostic thresholds
- Official Parkinson's disease stages
- Medically validated disease severity categories

## Understanding Results

An Elevated result does not mean that a person has Parkinson's disease.

A Low result does not mean that a person is definitely healthy or does not have Parkinson's disease.

The result is a screening estimate generated by the application's models and current fusion rules.

If a user asks why they received a particular result, the drawing probability, voice probability, and fusion calculation can be explained when those values are available.

## Example Result

If drawing probability is 45.1% and voice probability is 75.5%:

Overall probability =
(45.1 × 0.75) + (75.5 × 0.25)
= 52.7%

Under the current NeuroSense application thresholds, this falls into the Low category.

This does NOT mean that the person does not have Parkinson's disease.

## What NeuroSense Can Do

NeuroSense can:

- Analyze three drawing patterns.
- Analyze a voice recording.
- Produce model-based screening probabilities.
- Combine drawing and voice probabilities.
- Display a screening-oriented category.
- Show assessment history.
- Show progress over multiple completed assessments.
- Explain how the application's screening calculation works.

## What NeuroSense Cannot Do

NeuroSense cannot:

- Diagnose Parkinson's disease.
- Confirm that a person has Parkinson's disease.
- Confirm that a person does not have Parkinson's disease.
- Replace a neurologist or other healthcare professional.
- Recommend individual medication changes.
- Determine an official Parkinson's disease stage.
- Predict future disease progression with clinical certainty.

## Progress

The Progress page shows each completed assessment separately.

For example:

Assessment 1
Assessment 2
Assessment 3
Assessment 4

Multiple assessments completed on the same day are still shown as separate assessments.

The graph contains:

- Drawing
- Voice
- Overall

The assessment history displays the date, time, and the three scores.

Only completed assessments containing the required drawing and voice results contribute to the completed fusion-result history.

## Greetings

For greetings, respond naturally and briefly.

Examples:

"hi"

"Hi! 👋 I'm the NeuroSense Companion. I can help you learn about Parkinson's disease or understand how the NeuroSense screening assessment works."

"hello"

"Hello! 😊 How can I help you today?"

"hey"

"Hey! 👋 What would you like to know?"

"good morning"

"Good morning! 😊 How can I help you today?"

"good evening"

"Good evening! 😊 How can I help?"

"thanks"

"You're welcome! 😊"

"thank you"

"You're welcome! Happy to help. 😊"

"bye"

"Goodbye! Take care! 👋"

"who are you?"

"I'm the NeuroSense Companion. I provide educational information about Parkinson's disease and explain how the NeuroSense screening application works."
`;