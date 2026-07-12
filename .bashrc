alias mytree="find . -print | sed -e 's;/*/;|;g;s;|; |;g'"
alias checkfetch="grep ' fetch(' ./apps/web/src -rn | grep -vE 'proxy|services|providers|.md|disabled|test|example|hooks|backup'"
