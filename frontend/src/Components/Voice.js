import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import char from '../Components/images/char.png';
import stringSimilarity from "string-similarity";
import { useSpeechSynthesis } from 'react-speech-kit';

export default function VoiceAssistant(props) {
  const jsonData = props.data;
  const [searchText, setSearchText] = useState('');
  const [repeatButton, setRepeatButton] = useState(true);
  const [inputSource, setInputSource] = useState('voice');



  useEffect(() => {
    if (inputSource === 'voice' || inputSource === 'voice1') { 
      speak({ text: mytranscript });
    }
  }, [inputSource]);

  async function generateAnswer(question) {
    const apiKey = process.env.REACT_APP_API_KEY; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Provide a concise response based on Indian laws for the following query: "${question}" .If the query is irrelavent or Indian law cannot be applied on it or any other reason of invalid question then in response say 'Can you please explain your query in detail so that I can generate a response for you' something like this in a polite and friendly manner.` }] }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const generatedAnswer = data["candidates"][0]["content"]["parts"][0].text;

      const invalidPhrases = [
        "Indian law cannot be applied",
        "Can you please explain your query in detail",
        "insufficient",
        "invalid question",
        "not applicable"
      ];

      const isValidAnswer = !invalidPhrases.some(phrase => generatedAnswer.includes(phrase));

      if (isValidAnswer) {
        newtranscript(generatedAnswer);
        storeNewQuestionInDB(question, generatedAnswer); // Store valid answer in DB
      } else {
        newtranscript("Can you please explain your query in more detail so I can generate a response for you?");
      }

    } catch (error) {
      console.error('Error fetching data from Gemini API:', error);
      newtranscript("I encountered an error while trying to generate an answer.");
    }
  }

  async function storeNewQuestionInDB(question, answer) {
    try {
      const response = await fetch(process.env.REACT_APP_SERVER_URL+'/data', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, category: "Gen-Ai" }),
      });

      if (!response.ok) {
        throw new Error('Error storing new question and answer.');
      }
    } catch (error) {
      console.error('Error storing question and answer:', error);
    }
  }

  const handleSearch = () => {
    setInputSource('text');
    setRepeatButton(true);
    findanswer(searchText);
  };

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition({ onEnd: () => submit() });
  const [mytranscript, newtranscript] = useState(transcript);
  const { speak, voices } = useSpeechSynthesis();

  function calculateMatchingWords(str1, str2) {
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    let matchCount = 0;
    for (const word1 of words1) {
      if (words2.includes(word1)) {
        matchCount++;
      }
    }
    return matchCount;
  }

  function findanswer(transcript) {
    if (jsonData && jsonData.length > 0) {
      let bestMatch = null;
      let highestSimilarity = 0;
      const lowerCaseInput = transcript.toLowerCase();
  
      for (const question of jsonData) {
        const similarity = stringSimilarity.compareTwoStrings(lowerCaseInput, question.question.toLowerCase());
  
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = question;
        }
      }
  
      const similarityThreshold = 0.5;
  
      if (highestSimilarity >= similarityThreshold) {
        console.log("Answer from DB:", bestMatch.answer);
        newtranscript(bestMatch.answer); 
      } else {
        console.log("Querying Gemini API due to low similarity:", highestSimilarity);
        generateAnswer(transcript);
      }
    } else {
      console.log("No questions in the database.");
      newtranscript("Unfortunately, I couldn't find a relevant answer to your query.");
    }
  }

  if (!browserSupportsSpeechRecognition) {
    return null;
  }

  function check() {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      SpeechRecognition.startListening({ continuous: true });
      if (transcript) {
        newtranscript('');
        resetTranscript();
      }
    }
  }

  function submit() {
    if (!listening) {
      return null;
    } else {
      if (inputSource === 'voice') {
        setInputSource('voice1');
      } else {
        setInputSource('voice');
      }
      console.log(inputSource);
      setRepeatButton(true);
      findanswer(transcript);
    }
  }

  function clicks() {
    check();
    submit();
  }
  function reset() {
    resetTranscript();
    newtranscript('');
  }

  return (
    <>
      <div className='container-fluid'>
        <div className="row" style={{ background: "linear-gradient(90deg, rgba(0,120,183,1) 0%, rgba(7,24,68,1) 100%)" }}>
          <div className="col-lg-4 col-md-6 col-sm-12 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "85vh" }}>

            <img src={char} alt='our char' className="img-fluid" style={{ maxWidth: '90vw' }} />
            <div className="text-center">
              <button className="btn btn-success" onClick={clicks} style={{ borderRadius: '50%', marginRight: '10px' }}>
                {listening ? <span className="material-symbols-outlined" style={{ fontSize: '4  5px' }}>
                  mic_off
                </span> : <span className="material-symbols-outlined" style={{ fontSize: '45px' }}>
                  mic
                </span>}
              </button>

              <button className="btn btn-warning" onClick={reset} style={{ borderRadius: '50%' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '45px' }}>refresh</span>
              </button>

            </div>
          </div>
          <div className="col-lg-8 col-md-6 col-sm-12 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "95vh" }}>

            <div className="input-group" style={{ width: '100%', maxWidth: '450px', margin: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button
                className="btn btn-outline-secondary "
                type="button"
                onClick={handleSearch}
              >
                <span className="material-symbols-outlined ">
                  search
                </span>
              </button>
            </div>
            <div className="response text-center" style={{ width: '100%', maxWidth: '650px', minHeight: "60vh", backgroundColor: transcript || mytranscript ? "rgba(255,255,255,0.5)" : "transparent", borderRadius: "50px", padding: "20px" }}>
              <div className="row-2 text-center my-4" style={{ padding: "2%", margin: "2%", fontSize: "18px", fontWeight: "bold" }} >
                {transcript}
              </div>
              <div className="row-2 text-center position-relative" style={{ fontSize: "18px", padding: "2%", margin: "2%", height: "50vh" }} >
                {mytranscript !== "" ? (
                  <>
                    {mytranscript}
                    {repeatButton && <div className="d-grid gap-2 col-2 mx-auto text-center position-absolute bottom-0 end-0">
                      <button className="btn btn-primary" onClick={() => speak({ text: mytranscript })} type="button"><span className="material-symbols-outlined">
                        text_to_speech
                      </span></button>
                    </div>}
                  </>
                ) : (<></>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}