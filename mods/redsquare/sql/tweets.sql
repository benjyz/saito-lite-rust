CREATE TABLE IF NOT EXISTS tweets (
  id 			INTEGER,
  tx 			TEXT,
  sig 			VARCHAR(99),
  publickey 		VARCHAR(99),
  thread_id 		VARCHAR(99),
  parent_id 		VARCHAR(99),
  text 			TEXT,
  html 			TEXT,
  flagged 		INTEGER,
  moderated 		INTEGER,
  num_likes 		INTEGER,
  num_retweets 		INTEGER,
  created_at 		INTEGER,
  updated_at 		INTEGER,
  UNIQUE 		(id),
  UNIQUE 		(sig),
  PRIMARY KEY 		(id ASC)
);

