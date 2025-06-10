Github Agent

1. Creating a new project - ANalayzes the project repo code
2. Updating the knowledge when there are new commits in the repo
3. Get information about the proejct
4. Update info about the project manually

Email Agent

1. Creating a new project - After the project anlaysis, it will send a welcome email describing all the instructions and steps on how this agent would work
2. When there is a need for manual intervention or confirmation for some tweet mention or message from social agent, the social agent will trigger the email agent to send an email (There is no need to send an acknowledgement of that to the orchestartor or the social agent)
3. If the compliance agent finds a similar idea on the internet, it should trigger the email agent to send a email with a request for call-to-action (aka to raise a dispute)
4. If any new grant opportunity arises in Karma, karma agent will trigger to send an email alert to the user about the grant opportunity
5. If any new leads agent found any leads opportunity, leads agent will trigger to send an email alert to the user about the opportunity

Karma Agent

1. Creating a new project - It should trigger a function in karma to create the project
2. When the user makes any update to the project, it should update it in the DB
3. When there is a new opportunity, send an email trigger to the email agent

Compliance Agent

1. Creating a new project - It should start the search service for the project
2. When there is a duplicate of the proejct on the internet, will tag the source and ask the email agent to send an email
3. To track the status of the claims

IP Agent

1. Creating a new project - It should mint IP for the user
2. Function to Update IP terms or add more IP functions if possble
3. Functio to Claim collected IP revenue

Leads Agent

1. Creating a new project - Starts the leads search process
2. If found a good lead, triggers the email to send an email

Socials Agent

1. Creating a new project - Sets up the X account and Telegram account (if the user passes its secrets)
2. For X, listens to new relevant tweets, responds back, likes or ignores, makes new tweets periodically based on the status of the proejct and any interesting news. If anything important, sends an email for the user to know
3. For telegram, listens to messages sent to it, or new messages in the group and responds to it. If anything important, sends an email to let the user know
4. Every week, it gives a summary on overall social interactions and progess made by the agent to get social metrics

Agents

1. Orchestrator - DONE
2. Email - DONE
3. Github - DONE & Tested
4. Karma - DONE
5. Leads -
6. Socials -
7. IP -
8. Monitoring -
